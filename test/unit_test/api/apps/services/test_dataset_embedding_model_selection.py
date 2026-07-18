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
from api.db import WorkspaceType


def test_team_uses_its_default_embedding_model_when_personal_model_is_submitted(monkeypatch):
    def verify(model_id, workspace_id):
        assert workspace_id == "team-1"
        return (model_id == "team-embedding", None if model_id == "team-embedding" else "wrong workspace")

    monkeypatch.setattr(dataset_api_service, "verify_embedding_availability", verify)

    model_id, error = dataset_api_service._select_workspace_embedding_model(
        "personal-embedding",
        "team-1",
        WorkspaceType.TEAM,
        SimpleNamespace(tenant_embd_id="team-embedding", embd_id="team-embedding-name"),
    )

    assert model_id == "team-embedding"
    assert error is None


def test_personal_workspace_does_not_fall_back_from_an_invalid_model(monkeypatch):
    monkeypatch.setattr(
        dataset_api_service,
        "verify_embedding_availability",
        lambda model_id, workspace_id: (False, "wrong workspace"),
    )

    model_id, error = dataset_api_service._select_workspace_embedding_model(
        "other-users-embedding",
        "user-1",
        WorkspaceType.PERSONAL,
        SimpleNamespace(tenant_embd_id="personal-default", embd_id="personal-default-name"),
    )

    assert model_id is None
    assert error == "wrong workspace"
