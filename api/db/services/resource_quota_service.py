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

from api.db import CanvasCategory, FileType, UserTenantRole
from api.db.db_models import (
    DB,
    Dialog,
    Document,
    File,
    File2Document,
    Knowledgebase,
    Memory,
    Search,
    Tenant,
    UserCanvas,
    UserTenant,
)
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
        metric_name = {
            "file_count": "文件数量",
            "storage_bytes": "文件存储",
            "team_count": "团队数量",
            "dataset_count": "知识库数量",
            "chat_count": "聊天数量",
            "search_count": "搜索数量",
            "agent_count": "智能体数量",
            "memory_count": "记忆数量",
        }.get(metric, metric)
        super().__init__(f"{scope}{metric_name}已达到配额限制，请联系管理员调整配额。")


class ResourceQuotaService:
    """Persist and enforce workspace quotas without extending resource tables."""

    SETTING_NAME = "admin.resource_quotas"
    CREATION_METRICS = (
        "team_count",
        "dataset_count",
        "chat_count",
        "search_count",
        "agent_count",
        "memory_count",
    )
    RESOURCE_METRICS = {
        "dataset": "dataset_count",
        "chat": "chat_count",
        "search": "search_count",
        "agent": "agent_count",
        "memory": "memory_count",
    }

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
        normalized = {
            "file_count_limit": cls._normalize_limit(quota.get("file_count_limit")),
            "storage_bytes_limit": cls._normalize_limit(quota.get("storage_bytes_limit")),
        }
        normalized.update(
            {
                f"{metric}_limit": cls._normalize_limit(
                    quota.get(f"{metric}_limit")
                )
                for metric in cls.CREATION_METRICS
            }
        )
        return normalized

    @classmethod
    def set_workspace_quota(cls, workspace_id: str, quota: dict) -> dict:
        with DB.lock("resource_quota_settings", 10):
            data = cls._load()
            normalized = cls._normalize_quota(
                {
                    **data["workspaces"].get(workspace_id, {}),
                    **(quota or {}),
                }
            )
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
            normalized = cls._normalize_quota(
                {
                    **data["datasets"].get(dataset_id, {}),
                    **(quota or {}),
                }
            )
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

    @classmethod
    def _empty_creation_usage(cls) -> dict[str, int]:
        return {f"{metric}_used": 0 for metric in cls.CREATION_METRICS}

    @classmethod
    def _workspace_creation_usage(
        cls, workspace_ids: list[str]
    ) -> dict[str, dict[str, int]]:
        workspace_ids = list(dict.fromkeys(workspace_ids))
        result = {
            workspace_id: cls._empty_creation_usage()
            for workspace_id in workspace_ids
        }
        if not workspace_ids:
            return result

        valid = StatusEnum.VALID.value

        def apply_grouped_usage(model, workspace_field, metric, *conditions):
            for row in (
                model.select(
                    workspace_field.alias("workspace_id"),
                    fn.COUNT(model.id).alias("resource_count"),
                )
                .where(workspace_field.in_(workspace_ids), *conditions)
                .group_by(workspace_field)
                .dicts()
            ):
                result[row["workspace_id"]][f"{metric}_used"] = int(
                    row["resource_count"] or 0
                )

        apply_grouped_usage(
            Knowledgebase,
            Knowledgebase.tenant_id,
            "dataset_count",
            Knowledgebase.status == valid,
        )
        apply_grouped_usage(
            Dialog,
            Dialog.tenant_id,
            "chat_count",
            Dialog.status == valid,
        )
        apply_grouped_usage(
            Search,
            Search.tenant_id,
            "search_count",
            Search.status == valid,
        )
        apply_grouped_usage(
            UserCanvas,
            UserCanvas.user_id,
            "agent_count",
            UserCanvas.canvas_category == CanvasCategory.Agent,
        )
        apply_grouped_usage(
            Memory,
            Memory.tenant_id,
            "memory_count",
        )

        for row in (
            UserTenant.select(
                UserTenant.user_id.alias("workspace_id"),
                fn.COUNT(UserTenant.id).alias("resource_count"),
            )
            .join(Tenant, on=(UserTenant.tenant_id == Tenant.id))
            .where(
                UserTenant.user_id.in_(workspace_ids),
                UserTenant.tenant_id != UserTenant.user_id,
                UserTenant.role == UserTenantRole.OWNER,
                UserTenant.status == valid,
                Tenant.status == valid,
            )
            .group_by(UserTenant.user_id)
            .dicts()
        ):
            result[row["workspace_id"]]["team_count_used"] = int(
                row["resource_count"] or 0
            )
        return result

    @classmethod
    def _with_usage(
        cls,
        quota: dict,
        usage: QuotaUsage,
        creation_usage: dict[str, int] | None = None,
    ) -> dict:
        return {
            **quota,
            "file_count_used": usage.file_count,
            "storage_bytes_used": usage.storage_bytes,
            **(creation_usage or cls._empty_creation_usage()),
        }

    @classmethod
    def get_workspace_quota(cls, workspace_id: str) -> dict:
        quota = cls._normalize_quota(cls._load()["workspaces"].get(workspace_id))
        creation_usage = cls._workspace_creation_usage([workspace_id])[workspace_id]
        return cls._with_usage(
            quota,
            cls.get_workspace_usage(workspace_id),
            creation_usage,
        )

    @classmethod
    def get_dataset_quota(cls, dataset_id: str) -> dict:
        quota = cls._normalize_quota(cls._load()["datasets"].get(dataset_id))
        return cls._with_usage(quota, cls.get_dataset_usage(dataset_id))

    @classmethod
    def get_workspace_quotas(cls, workspace_ids: list[str]) -> dict[str, dict]:
        workspace_ids = list(dict.fromkeys(workspace_ids))
        if not workspace_ids:
            return {}

        valid = StatusEnum.VALID.value
        linked_document_ids = File2Document.select(File2Document.document_id).where(
            File2Document.document_id.is_null(False)
        )
        document_usage = {
            row["workspace_id"]: QuotaUsage(
                int(row["file_count"] or 0),
                int(row["storage_bytes"] or 0),
            )
            for row in (
                Document.select(
                    Knowledgebase.tenant_id.alias("workspace_id"),
                    fn.COUNT(Document.id).alias("file_count"),
                    fn.COALESCE(fn.SUM(Document.size), 0).alias("storage_bytes"),
                )
                .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
                .where(
                    Knowledgebase.tenant_id.in_(workspace_ids),
                    Document.status == valid,
                    Knowledgebase.status == valid,
                    ~(Document.id.in_(linked_document_ids)),
                )
                .group_by(Knowledgebase.tenant_id)
                .dicts()
            )
        }
        file_usage = {
            row["workspace_id"]: QuotaUsage(
                int(row["file_count"] or 0),
                int(row["storage_bytes"] or 0),
            )
            for row in (
                File.select(
                    File.tenant_id.alias("workspace_id"),
                    fn.COUNT(File.id).alias("file_count"),
                    fn.COALESCE(fn.SUM(File.size), 0).alias("storage_bytes"),
                )
                .where(
                    File.tenant_id.in_(workspace_ids),
                    File.type != FileType.FOLDER.value,
                )
                .group_by(File.tenant_id)
                .dicts()
            )
        }
        configured = cls._load()["workspaces"]
        creation_usage = cls._workspace_creation_usage(workspace_ids)
        result = {}
        for workspace_id in workspace_ids:
            documents = document_usage.get(workspace_id, QuotaUsage(0, 0))
            files = file_usage.get(workspace_id, QuotaUsage(0, 0))
            usage = QuotaUsage(
                documents.file_count + files.file_count,
                documents.storage_bytes + files.storage_bytes,
            )
            result[workspace_id] = cls._with_usage(
                cls._normalize_quota(configured.get(workspace_id)),
                usage,
                creation_usage[workspace_id],
            )
        return result

    @classmethod
    def get_dataset_quotas(cls, dataset_ids: list[str]) -> dict[str, dict]:
        dataset_ids = list(dict.fromkeys(dataset_ids))
        if not dataset_ids:
            return {}

        valid = StatusEnum.VALID.value
        usage_by_dataset = {
            row["dataset_id"]: QuotaUsage(
                int(row["file_count"] or 0),
                int(row["storage_bytes"] or 0),
            )
            for row in (
                Document.select(
                    Document.kb_id.alias("dataset_id"),
                    fn.COUNT(Document.id).alias("file_count"),
                    fn.COALESCE(fn.SUM(Document.size), 0).alias("storage_bytes"),
                )
                .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
                .where(
                    Document.kb_id.in_(dataset_ids),
                    Document.status == valid,
                    Knowledgebase.status == valid,
                )
                .group_by(Document.kb_id)
                .dicts()
            )
        }
        configured = cls._load()["datasets"]
        return {
            dataset_id: cls._with_usage(
                cls._normalize_quota(configured.get(dataset_id)),
                usage_by_dataset.get(dataset_id, QuotaUsage(0, 0)),
            )
            for dataset_id in dataset_ids
        }

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

    @classmethod
    def _ensure_creation_metric(
        cls,
        scope: str,
        quota: dict,
        metric: str,
    ) -> None:
        limit = quota[f"{metric}_limit"]
        used = quota[f"{metric}_used"]
        if limit is not None and used + 1 > limit:
            raise ResourceQuotaExceededError(scope, metric, used, 1, limit)

    @classmethod
    def ensure_team_creation_allowed(cls, user_id: str) -> None:
        cls._ensure_creation_metric(
            "用户",
            cls.get_workspace_quota(user_id),
            "team_count",
        )

    @classmethod
    def ensure_resource_creation_allowed(
        cls,
        workspace_id: str,
        resource_type: str,
    ) -> None:
        metric = cls.RESOURCE_METRICS.get(resource_type)
        if not metric:
            raise ValueError(f"Unsupported quota resource type: {resource_type}")
        cls._ensure_creation_metric(
            "工作空间",
            cls.get_workspace_quota(workspace_id),
            metric,
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
