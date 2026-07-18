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

from api.db.services.system_settings_service import SystemSettingsService


class SharedModelService:
    """Persist administrator-managed model visibility without another table."""

    SETTING_NAME = "admin.shared_models"

    @classmethod
    def _load(cls) -> dict:
        settings = SystemSettingsService.get_by_name(cls.SETTING_NAME)
        if not settings:
            return {"models": {}}
        try:
            data = json.loads(settings[0].value)
        except (TypeError, json.JSONDecodeError):
            data = {}
        models = data.get("models")
        return {"models": models if isinstance(models, dict) else {}}

    @classmethod
    def _save(cls, data: dict) -> None:
        value = json.dumps(data, ensure_ascii=False, sort_keys=True)
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

    @classmethod
    def list_entries(cls) -> dict[str, dict]:
        return cls._load()["models"]

    @classmethod
    def get_entry(cls, model_id: str) -> dict | None:
        return cls.list_entries().get(model_id)

    @classmethod
    def set_access(
        cls,
        model_id: str,
        *,
        visibility: str = "all",
        workspace_ids: list[str] | None = None,
        created_by: str = "",
    ) -> dict:
        if visibility not in {"all", "selected"}:
            raise ValueError("visibility must be 'all' or 'selected'")
        data = cls._load()
        entry = {
            "visibility": visibility,
            "workspace_ids": sorted({str(workspace_id) for workspace_id in workspace_ids or [] if workspace_id}),
            "created_by": created_by or data["models"].get(model_id, {}).get("created_by", ""),
        }
        data["models"][model_id] = entry
        cls._save(data)
        return entry

    @classmethod
    def remove(cls, model_id: str) -> None:
        data = cls._load()
        if data["models"].pop(model_id, None) is not None:
            cls._save(data)

    @classmethod
    def is_managed(cls, model_id: str) -> bool:
        return model_id in cls.list_entries()

    @classmethod
    def can_use(cls, workspace_id: str, model_id: str) -> bool:
        entry = cls.get_entry(model_id)
        if not entry:
            return False
        return entry.get("visibility", "all") == "all" or workspace_id in set(entry.get("workspace_ids") or [])

    @classmethod
    def list_accessible_model_ids(cls, workspace_id: str) -> set[str]:
        return {
            model_id
            for model_id, entry in cls.list_entries().items()
            if entry.get("visibility", "all") == "all" or workspace_id in set(entry.get("workspace_ids") or [])
        }
