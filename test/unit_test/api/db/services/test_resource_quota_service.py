from contextlib import nullcontext
from io import BytesIO
from types import SimpleNamespace

import pytest

from api.db.db_models import DB
from api.db.services.resource_quota_service import (
    QuotaUsage,
    ResourceQuotaExceededError,
    ResourceQuotaService,
)


def test_set_workspace_quota_normalizes_and_persists(monkeypatch):
    data = {"workspaces": {}, "datasets": {}}
    saved = []
    monkeypatch.setattr(DB, "lock", lambda *args, **kwargs: nullcontext())
    monkeypatch.setattr(ResourceQuotaService, "_load", classmethod(lambda cls: data))
    monkeypatch.setattr(
        ResourceQuotaService,
        "_save",
        classmethod(lambda cls, value: saved.append(value.copy())),
    )
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_usage",
        classmethod(lambda cls, workspace_id: QuotaUsage(3, 1024)),
    )
    monkeypatch.setattr(
        ResourceQuotaService,
        "_workspace_creation_usage",
        classmethod(
            lambda cls, workspace_ids: {
                workspace_id: cls._empty_creation_usage()
                for workspace_id in workspace_ids
            }
        ),
    )

    quota = ResourceQuotaService.set_workspace_quota(
        "workspace-1",
        {"file_count_limit": "10", "storage_bytes_limit": 2048},
    )

    assert data["workspaces"]["workspace-1"] == {
        "file_count_limit": 10,
        "storage_bytes_limit": 2048,
        **{
            f"{metric}_limit": None
            for metric in ResourceQuotaService.CREATION_METRICS
        },
    }
    assert quota == {
        "file_count_limit": 10,
        "storage_bytes_limit": 2048,
        **{
            f"{metric}_limit": None
            for metric in ResourceQuotaService.CREATION_METRICS
        },
        "file_count_used": 3,
        "storage_bytes_used": 1024,
        **ResourceQuotaService._empty_creation_usage(),
    }
    assert saved


def test_unconfigured_quota_is_unlimited(monkeypatch):
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_quota",
        classmethod(
            lambda cls, workspace_id: {
                "file_count_limit": None,
                "storage_bytes_limit": None,
                "file_count_used": 100,
                "storage_bytes_used": 10_000,
            }
        ),
    )

    ResourceQuotaService.ensure_upload_allowed("workspace-1", None, 10, 20_000)


def test_workspace_file_count_limit_is_enforced(monkeypatch):
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_quota",
        classmethod(
            lambda cls, workspace_id: {
                "file_count_limit": 5,
                "storage_bytes_limit": None,
                "file_count_used": 4,
                "storage_bytes_used": 0,
            }
        ),
    )

    with pytest.raises(ResourceQuotaExceededError) as exc_info:
        ResourceQuotaService.ensure_upload_allowed("workspace-1", None, 2, 0)

    assert exc_info.value.scope == "工作空间"
    assert exc_info.value.metric == "file_count"
    assert str(exc_info.value) == "工作空间文件数量已达到配额限制，请联系管理员调整配额。"
    assert "4" not in str(exc_info.value)
    assert "5" not in str(exc_info.value)


def test_dataset_storage_limit_is_enforced_after_workspace(monkeypatch):
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_quota",
        classmethod(
            lambda cls, workspace_id: {
                "file_count_limit": None,
                "storage_bytes_limit": 10_000,
                "file_count_used": 1,
                "storage_bytes_used": 100,
            }
        ),
    )
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_dataset_quota",
        classmethod(
            lambda cls, dataset_id: {
                "file_count_limit": None,
                "storage_bytes_limit": 200,
                "file_count_used": 1,
                "storage_bytes_used": 150,
            }
        ),
    )

    with pytest.raises(ResourceQuotaExceededError) as exc_info:
        ResourceQuotaService.ensure_upload_allowed(
            "workspace-1", "dataset-1", 1, 100
        )

    assert exc_info.value.scope == "知识库"
    assert exc_info.value.metric == "storage_bytes"


def test_replacement_that_does_not_increase_usage_is_allowed(monkeypatch):
    quota = {
        "file_count_limit": 1,
        "storage_bytes_limit": 100,
        "file_count_used": 2,
        "storage_bytes_used": 200,
    }
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_quota",
        classmethod(lambda cls, workspace_id: quota),
    )
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_dataset_quota",
        classmethod(lambda cls, dataset_id: quota),
    )

    ResourceQuotaService.ensure_upload_allowed("workspace-1", "dataset-1", 0, -10)


def test_get_upload_size_restores_stream_position():
    stream = BytesIO(b"abcdef")
    stream.seek(2)
    upload = SimpleNamespace(stream=stream)

    assert ResourceQuotaService.get_upload_size(upload) == 6
    assert stream.tell() == 2


def test_workspace_resource_creation_limit_is_enforced(monkeypatch):
    quota = {
        **{
            f"{metric}_limit": None
            for metric in ResourceQuotaService.CREATION_METRICS
        },
        **ResourceQuotaService._empty_creation_usage(),
    }
    quota["agent_count_limit"] = 2
    quota["agent_count_used"] = 2
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_quota",
        classmethod(lambda cls, workspace_id: quota),
    )

    with pytest.raises(ResourceQuotaExceededError) as exc_info:
        ResourceQuotaService.ensure_resource_creation_allowed(
            "workspace-1", "agent"
        )

    assert exc_info.value.scope == "工作空间"
    assert exc_info.value.metric == "agent_count"


def test_unconfigured_creation_limits_are_unlimited(monkeypatch):
    quota = {
        **{
            f"{metric}_limit": None
            for metric in ResourceQuotaService.CREATION_METRICS
        },
        **{
            f"{metric}_used": 100
            for metric in ResourceQuotaService.CREATION_METRICS
        },
    }
    monkeypatch.setattr(
        ResourceQuotaService,
        "get_workspace_quota",
        classmethod(lambda cls, workspace_id: quota),
    )

    ResourceQuotaService.ensure_team_creation_allowed("user-1")
    for resource_type in ResourceQuotaService.RESOURCE_METRICS:
        ResourceQuotaService.ensure_resource_creation_allowed(
            "workspace-1", resource_type
        )
