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

from api.db.services.user_service import TenantService
from common.constants import ParserType


class WorkspaceParserService:
    EXTENDED_PARSERS = {ParserType.EXAMPLE_CHUNK.value: "Extension Example Chunking"}

    @staticmethod
    def parse_parser_ids(raw: str | None) -> list[tuple[str, str]]:
        parsers: list[tuple[str, str]] = []
        for item in str(raw or "").split(","):
            parser_id, separator, label = item.strip().partition(":")
            if parser_id:
                parsers.append((parser_id, label if separator and label else parser_id))
        return parsers

    @classmethod
    def is_allowed(cls, workspace_id: str, parser_id: str | None) -> bool:
        if parser_id not in cls.EXTENDED_PARSERS:
            return True
        exists, tenant = TenantService.get_by_id(workspace_id)
        if not exists:
            return False
        return parser_id in {item_id for item_id, _label in cls.parse_parser_ids(tenant.parser_ids)}

    @classmethod
    def list_settings(cls, workspace_id: str) -> list[dict]:
        exists, tenant = TenantService.get_by_id(workspace_id)
        if not exists:
            raise LookupError("Workspace not found")
        enabled_parser_ids = {item_id for item_id, _label in cls.parse_parser_ids(tenant.parser_ids)}
        return [
            {
                "parser_id": parser_id,
                "label": label,
                "enabled": parser_id in enabled_parser_ids,
            }
            for parser_id, label in cls.EXTENDED_PARSERS.items()
        ]

    @classmethod
    def set_enabled(cls, workspace_id: str, parser_id: str, enabled: bool) -> dict:
        if parser_id not in cls.EXTENDED_PARSERS:
            raise ValueError(f"Unsupported extended chunk method: {parser_id}")
        exists, tenant = TenantService.get_by_id(workspace_id)
        if not exists:
            raise LookupError("Workspace not found")

        parsers = cls.parse_parser_ids(tenant.parser_ids)
        parsers = [(item_id, label) for item_id, label in parsers if item_id != parser_id]
        if enabled:
            parsers.append((parser_id, cls.EXTENDED_PARSERS[parser_id]))
        parser_ids = ",".join(f"{item_id}:{label}" for item_id, label in parsers)
        TenantService.update_by_id(workspace_id, {"parser_ids": parser_ids})
        return {"workspace_id": workspace_id, "chunk_method": parser_id, "enabled": enabled}

    @classmethod
    def require_allowed(cls, workspace_id: str, parser_id: str | None) -> None:
        if not cls.is_allowed(workspace_id, parser_id):
            raise PermissionError("The chunk method is not enabled for this workspace.")
