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

from api.apps.services import dataset_api_service


def test_get_dataset_includes_actor_capabilities(monkeypatch):
    knowledgebase = SimpleNamespace(
        id="dataset",
        tenant_id="team",
        created_by="creator",
        to_dict=lambda: {
            "id": "dataset",
            "tenant_id": "team",
            "created_by": "creator",
        },
    )
    workspace = SimpleNamespace(name="Team")
    creator = SimpleNamespace(nickname="Creator", avatar="avatar")
    expected_capabilities = {"read": True, "update": False, "delete": False}

    monkeypatch.setattr(dataset_api_service.KnowledgebaseService, "accessible", lambda *_args: True)
    monkeypatch.setattr(dataset_api_service.KnowledgebaseService, "get_by_id", lambda _dataset_id: (True, knowledgebase))
    monkeypatch.setattr(dataset_api_service.DocumentService, "get_total_size_by_kb_id", lambda _dataset_id: 0)
    monkeypatch.setattr(dataset_api_service.Connector2KbService, "list_connectors", lambda _dataset_id: [])
    monkeypatch.setattr(dataset_api_service.TenantService, "get_by_id", lambda _workspace_id: (True, workspace))
    monkeypatch.setattr(dataset_api_service.UserService, "get_by_id", lambda _user_id: (True, creator))
    monkeypatch.setattr(dataset_api_service.WorkspaceAccessService, "get_workspace_type", lambda _workspace_id: "team")
    monkeypatch.setattr(
        dataset_api_service.WorkspaceAccessService,
        "get_knowledgebase_capabilities",
        lambda actor_id, _knowledgebase: expected_capabilities if actor_id == "readonly-user" else {},
    )

    success, result = dataset_api_service.get_dataset("dataset", "readonly-user")

    assert success
    assert result["capabilities"] == expected_capabilities
    assert result["workspace_name"] == "Team"
    assert result["creator_name"] == "Creator"
