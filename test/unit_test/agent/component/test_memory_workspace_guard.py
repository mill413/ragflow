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

from agent.component import message as message_module


class _FakeCanvas:
    _id = "agent-1"
    task_id = "session-1"

    def get_tenant_id(self):
        return "team-1"

    def get_sys_query(self):
        return "question"


@pytest.mark.asyncio
async def test_message_rejects_memory_from_another_workspace(monkeypatch):
    component = message_module.Message.__new__(message_module.Message)
    component._canvas = _FakeCanvas()
    component._param = SimpleNamespace(memory_ids=["memory-2"], user_id="")
    monkeypatch.setattr(
        message_module.AgentReferenceService,
        "require_memories",
        lambda *_args: (_ for _ in ()).throw(PermissionError("Agents can only reference memories from the same workspace.")),
    )

    with pytest.raises(PermissionError, match="same workspace"):
        await component._save_to_memory("answer")


@pytest.mark.asyncio
async def test_message_writes_only_normalized_workspace_memories(monkeypatch):
    component = message_module.Message.__new__(message_module.Message)
    component._canvas = _FakeCanvas()
    component._param = SimpleNamespace(memory_ids=["memory-1", "memory-1"], user_id="user-1")
    monkeypatch.setattr(message_module.AgentReferenceService, "require_memories", lambda *_args: [SimpleNamespace(id="memory-1", tenant_id="team-1")])
    captured = {}

    async def queue(memory_ids, message):
        captured["memory_ids"] = memory_ids
        captured["message"] = message
        return True, "success"

    monkeypatch.setattr(message_module, "queue_save_to_memory_task", queue)

    result = await component._save_to_memory("answer")

    assert result == (True, "success")
    assert captured["memory_ids"] == ["memory-1"]
    assert captured["message"]["agent_id"] == "agent-1"
