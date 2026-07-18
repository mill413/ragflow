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

from types import SimpleNamespace

import pytest

from api.db.services.agent_reference_service import AgentReferenceService


def test_require_memories_rejects_cross_workspace_reference(monkeypatch):
    monkeypatch.setattr(
        "api.db.services.agent_reference_service.MemoryService.get_by_ids",
        lambda _memory_ids: [SimpleNamespace(id="memory-2", tenant_id="team-2")],
    )

    with pytest.raises(PermissionError, match="same workspace"):
        AgentReferenceService.require_memories("team-1", ["memory-2"])


def test_require_memories_rejects_missing_reference(monkeypatch):
    monkeypatch.setattr(
        "api.db.services.agent_reference_service.MemoryService.get_by_ids",
        lambda _memory_ids: [],
    )

    with pytest.raises(PermissionError, match="do not exist"):
        AgentReferenceService.require_memories("team-1", ["missing"])


def test_require_memories_normalizes_ids_and_preserves_order(monkeypatch):
    memories = {
        "memory-1": SimpleNamespace(id="memory-1", tenant_id="team-1"),
        "memory-2": SimpleNamespace(id="memory-2", tenant_id="team-1"),
    }
    monkeypatch.setattr(
        "api.db.services.agent_reference_service.MemoryService.get_by_ids",
        lambda memory_ids: [memories[memory_id] for memory_id in reversed(memory_ids)],
    )

    result = AgentReferenceService.require_memories("team-1", ["memory-1", "memory-2", "memory-1"])

    assert [memory.id for memory in result] == ["memory-1", "memory-2"]


def test_require_managed_file_rejects_cross_workspace_reference(monkeypatch):
    monkeypatch.setattr(
        "api.db.services.agent_reference_service.FileService.get_by_id",
        lambda _file_id: (True, SimpleNamespace(id="file-2", tenant_id="team-2")),
    )

    with pytest.raises(PermissionError, match="same workspace"):
        AgentReferenceService.require_managed_file("team-1", "file-2")


def test_require_upload_descriptor_rejects_forged_owner():
    with pytest.raises(PermissionError, match="same workspace"):
        AgentReferenceService.require_upload_descriptor(
            "team-1",
            {"id": "upload-1", "created_by": "user-2"},
        )
