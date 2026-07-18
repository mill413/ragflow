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

from api.apps.services import memory_api_service


@pytest.mark.asyncio
async def test_add_message_requires_management_of_every_memory(monkeypatch):
    memories = [
        SimpleNamespace(id="managed", permissions="team"),
        SimpleNamespace(id="readonly", permissions="team"),
    ]
    queued = False

    monkeypatch.setattr(memory_api_service, "current_user", SimpleNamespace(id="member"))
    monkeypatch.setattr(memory_api_service.MemoryService, "get_by_ids", lambda _ids: memories)
    monkeypatch.setattr(
        memory_api_service.WorkspaceAccessService,
        "can_manage_collaborative_resource",
        lambda _user_id, memory, **_kwargs: memory.id == "managed",
    )

    async def queue_messages(_memory_ids, _message):
        nonlocal queued
        queued = True
        return True, "queued"

    monkeypatch.setattr(memory_api_service, "queue_save_to_memory_task", queue_messages)

    success, message = await memory_api_service.add_message(
        ["managed", "readonly"],
        {"agent_id": "agent", "session_id": "session"},
    )

    assert not success
    assert message == "Memory not found."
    assert not queued


@pytest.mark.asyncio
async def test_message_mutations_require_memory_management(monkeypatch):
    requested_manage_flags = []
    memory = SimpleNamespace(id="memory", tenant_id="team")

    def require_memory(_memory_id, *, manage=False):
        requested_manage_flags.append(manage)
        return memory

    monkeypatch.setattr(memory_api_service, "_require_memory_access", require_memory)
    monkeypatch.setattr(memory_api_service.MessageService, "update_message", lambda *_args, **_kwargs: True)

    assert await memory_api_service.forget_message("memory", 1)
    assert await memory_api_service.update_message_status("memory", 1, False)
    assert requested_manage_flags == [True, True]


@pytest.mark.asyncio
async def test_delete_memory_as_admin_does_not_require_current_user(monkeypatch):
    memory = SimpleNamespace(id="memory", tenant_id="team")
    checked_references = []
    deleted_memories = []
    deleted_messages = []

    class CurrentUserMustNotBeRead:
        @property
        def id(self):
            raise AssertionError("admin deletion must not read the main-site current_user")

    monkeypatch.setattr(memory_api_service, "current_user", CurrentUserMustNotBeRead())
    monkeypatch.setattr(memory_api_service.MemoryService, "get_by_memory_id", lambda _memory_id: memory)
    monkeypatch.setattr(
        memory_api_service.ResourceReferenceService,
        "ensure_not_referenced",
        lambda resource_type, resources: checked_references.append((resource_type, resources)),
    )
    monkeypatch.setattr(memory_api_service.MemoryService, "delete_memory", deleted_memories.append)
    monkeypatch.setattr(memory_api_service.MessageService, "has_index", lambda _tenant_id, _memory_id: True)
    monkeypatch.setattr(
        memory_api_service.MessageService,
        "delete_message",
        lambda condition, tenant_id, memory_id: deleted_messages.append((condition, tenant_id, memory_id)),
    )

    assert await memory_api_service.delete_memory_as_admin("memory")
    assert checked_references == [("memory", [memory])]
    assert deleted_memories == ["memory"]
    assert deleted_messages == [({"memory_id": "memory"}, "team", "memory")]
