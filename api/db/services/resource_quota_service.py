#
#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.
#
#  Licensed under the Apache License, Version 2.0 (the "License");
#  you may not use this file except in compliance with the License.
#  You may obtain a copy of the License at
#
#      http://www.apache.org/licenses/LICENSE-2.0
#
#  Unless required by applicable law or agreed to in writing, software
#  distributed under the License is distributed on an "AS IS" BASIS,
#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#  See the License for the specific language governing permissions and
#  limitations under the License.
#

import json
from dataclasses import dataclass
from typing import BinaryIO

from peewee import fn

from api.db import FileType
from api.db.db_models import DB, Document, File, File2Document, Knowledgebase
from api.db.services.system_settings_service import SystemSettingsService
from common.constants import StatusEnum


@dataclass(frozen=True)
class QuotaUsage:
    file_count: int
    storage_bytes: int


class ResourceQuotaExceededError(ValueError):
    def __init__(self, scope: str, metric: str, used: int, requested: int, limit: int):
        self.scope = scope
        self.metric = metric
        self.used = used
        self.requested = requested
        self.limit = limit
        metric_name = "文件数量" if metric == "file_count" else "文件存储"
        super().__init__(
            f"{scope}{metric_name}配额不足：当前已使用 {used}，本次需要 {requested}，限制为 {limit}。"
        )


class ResourceQuotaService:
    """Persist and enforce upload quotas without extending resource tables."""

    SETTING_NAME = "admin.resource_quotas"

    @classmethod
    def _load(cls) -> dict:
        settings = SystemSettingsService.get_by_name(cls.SETTING_NAME)
        if not settings:
            return {"workspaces": {}, "datasets": {}}
        try:
            value = json.loads(settings[0].value)
        except (TypeError, json.JSONDecodeError):
            value = {}
        return {
            "workspaces": value.get("workspaces", {}),
            "datasets": value.get("datasets", {}),
        }

    @classmethod
    def _save(cls, data: dict) -> None:
        value = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        settings = SystemSettingsService.get_by_name(cls.SETTING_NAME)
        if settings:
            setting = settings[0].to_dict()
            setting["value"] = value
            SystemSettingsService.update_by_name(cls.SETTING_NAME, setting)
        else:
            SystemSettingsService.save(
                name=cls.SETTING_NAME,
                source="admin",
                data_type="json",
                value=value,
            )

    @staticmethod
    def _normalize_limit(value) -> int | None:
        if value in (None, ""):
            return None
        value = int(value)
        if value < 0:
            raise ValueError("Quota limit must be zero or greater.")
        return value

    @classmethod
    def _normalize_quota(cls, quota: dict | None) -> dict:
        quota = quota or {}
        return {
            "file_count_limit": cls._normalize_limit(quota.get("file_count_limit")),
            "storage_bytes_limit": cls._normalize_limit(quota.get("storage_bytes_limit")),
        }

    @classmethod
    def set_workspace_quota(cls, workspace_id: str, quota: dict) -> dict:
        with DB.lock("resource_quota_settings", 10):
            data = cls._load()
            normalized = cls._normalize_quota(quota)
            if all(value is None for value in normalized.values()):
                data["workspaces"].pop(workspace_id, None)
            else:
                data["workspaces"][workspace_id] = normalized
            cls._save(data)
        return cls.get_workspace_quota(workspace_id)

    @classmethod
    def set_dataset_quota(cls, dataset_id: str, quota: dict) -> dict:
        with DB.lock("resource_quota_settings", 10):
            data = cls._load()
            normalized = cls._normalize_quota(quota)
            if all(value is None for value in normalized.values()):
                data["datasets"].pop(dataset_id, None)
            else:
                data["datasets"][dataset_id] = normalized
            cls._save(data)
        return cls.get_dataset_quota(dataset_id)

    @classmethod
    def remove_workspace_quota(cls, workspace_id: str) -> None:
        with DB.lock("resource_quota_settings", 10):
            data = cls._load()
            if data["workspaces"].pop(workspace_id, None) is not None:
                cls._save(data)

    @classmethod
    def remove_dataset_quota(cls, dataset_id: str) -> None:
        with DB.lock("resource_quota_settings", 10):
            data = cls._load()
            if data["datasets"].pop(dataset_id, None) is not None:
                cls._save(data)

    @staticmethod
    def _document_usage(condition) -> QuotaUsage:
        valid = StatusEnum.VALID.value
        row = (
            Document.select(
                fn.COUNT(Document.id).alias("file_count"),
                fn.COALESCE(fn.SUM(Document.size), 0).alias("storage_bytes"),
            )
            .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
            .where(
                condition,
                Document.status == valid,
                Knowledgebase.status == valid,
            )
            .dicts()
            .first()
            or {}
        )
        return QuotaUsage(
            file_count=int(row.get("file_count", 0) or 0),
            storage_bytes=int(row.get("storage_bytes", 0) or 0),
        )

    @classmethod
    def get_dataset_usage(cls, dataset_id: str) -> QuotaUsage:
        return cls._document_usage(Document.kb_id == dataset_id)

    @classmethod
    def get_workspace_usage(cls, workspace_id: str) -> QuotaUsage:
        linked_document_ids = File2Document.select(File2Document.document_id).where(
            File2Document.document_id.is_null(False)
        )
        unlinked_document_usage = cls._document_usage(
            (Knowledgebase.tenant_id == workspace_id)
            & ~(Document.id.in_(linked_document_ids))
        )
        files = (
            File.select(
                fn.COUNT(File.id).alias("file_count"),
                fn.COALESCE(fn.SUM(File.size), 0).alias("storage_bytes"),
            )
            .where(
                File.tenant_id == workspace_id,
                File.type != FileType.FOLDER.value,
            )
            .dicts()
            .first()
            or {}
        )
        return QuotaUsage(
            file_count=unlinked_document_usage.file_count
            + int(files.get("file_count", 0) or 0),
            storage_bytes=unlinked_document_usage.storage_bytes
            + int(files.get("storage_bytes", 0) or 0),
        )

    @staticmethod
    def _with_usage(quota: dict, usage: QuotaUsage) -> dict:
        return {
            **quota,
            "file_count_used": usage.file_count,
            "storage_bytes_used": usage.storage_bytes,
        }

    @classmethod
    def get_workspace_quota(cls, workspace_id: str) -> dict:
        quota = cls._normalize_quota(cls._load()["workspaces"].get(workspace_id))
        return cls._with_usage(quota, cls.get_workspace_usage(workspace_id))

    @classmethod
    def get_dataset_quota(cls, dataset_id: str) -> dict:
        quota = cls._normalize_quota(cls._load()["datasets"].get(dataset_id))
        return cls._with_usage(quota, cls.get_dataset_usage(dataset_id))

    @staticmethod
    def _ensure_scope(
        scope: str,
        quota: dict,
        additional_file_count: int,
        additional_storage_bytes: int,
    ) -> None:
        checks = (
            ("file_count", quota["file_count_used"], additional_file_count, quota["file_count_limit"]),
            ("storage_bytes", quota["storage_bytes_used"], additional_storage_bytes, quota["storage_bytes_limit"]),
        )
        for metric, used, requested, limit in checks:
            if requested > 0 and limit is not None and used + requested > limit:
                raise ResourceQuotaExceededError(scope, metric, used, requested, limit)

    @classmethod
    def ensure_upload_allowed(
        cls,
        workspace_id: str,
        dataset_id: str | None,
        additional_file_count: int,
        additional_storage_bytes: int,
    ) -> None:
        workspace_quota = cls.get_workspace_quota(workspace_id)
        cls._ensure_scope(
            "工作空间",
            workspace_quota,
            additional_file_count,
            additional_storage_bytes,
        )
        if dataset_id:
            dataset_quota = cls.get_dataset_quota(dataset_id)
            cls._ensure_scope(
                "知识库",
                dataset_quota,
                additional_file_count,
                additional_storage_bytes,
            )

    @classmethod
    def ensure_dataset_capacity(
        cls,
        dataset_id: str,
        additional_file_count: int,
        additional_storage_bytes: int,
    ) -> None:
        cls._ensure_scope(
            "知识库",
            cls.get_dataset_quota(dataset_id),
            additional_file_count,
            additional_storage_bytes,
        )

    @staticmethod
    def get_upload_size(file_obj) -> int:
        stream: BinaryIO = getattr(file_obj, "stream", file_obj)
        try:
            position = stream.tell()
            stream.seek(0, 2)
            size = stream.tell()
            stream.seek(position)
            return int(size)
        except (AttributeError, OSError):
            content_length = getattr(file_obj, "content_length", None)
            if content_length is None:
                raise ValueError("Unable to determine uploaded file size.")
            return int(content_length)

    @classmethod
    def get_uploads_size(cls, file_objs: list) -> int:
        return sum(cls.get_upload_size(file_obj) for file_obj in file_objs)
