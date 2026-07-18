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

from collections.abc import Mapping
from typing import Any

from api.db.services.file_service import FileService
from api.db.services.memory_service import MemoryService


class AgentReferenceService:
    @staticmethod
    def normalize_ids(resource_ids) -> list[str]:
        return list(dict.fromkeys(resource_id for resource_id in resource_ids or [] if isinstance(resource_id, str) and resource_id))

    @classmethod
    def require_memories(cls, workspace_id: str, memory_ids) -> list:
        normalized_ids = cls.normalize_ids(memory_ids)
        memories = MemoryService.get_by_ids(normalized_ids)
        memory_by_id = {memory.id: memory for memory in memories}
        if not normalized_ids or set(memory_by_id) != set(normalized_ids):
            raise PermissionError("One or more selected memories do not exist.")
        if any(memory.tenant_id != workspace_id for memory in memories):
            raise PermissionError("Agents can only reference memories from the same workspace.")
        return [memory_by_id[memory_id] for memory_id in normalized_ids]

    @staticmethod
    def require_managed_file(workspace_id: str, file_id: str):
        exists, file = FileService.get_by_id(file_id)
        if not exists:
            raise FileNotFoundError(f"File '{file_id}' does not exist.")
        if file.tenant_id != workspace_id:
            raise PermissionError("Agents can only reference files from the same workspace.")
        return file

    @staticmethod
    def require_upload_descriptor(workspace_id: str, descriptor: Mapping[str, Any]) -> str:
        if not isinstance(descriptor, Mapping):
            raise PermissionError("Invalid agent upload descriptor.")
        file_id = descriptor.get("id") or descriptor.get("file_id")
        if not file_id or descriptor.get("created_by") != workspace_id:
            raise PermissionError("Agents can only read uploaded files from the same workspace.")
        return str(file_id)
