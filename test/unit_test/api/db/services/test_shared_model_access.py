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

from api.db.joint_services import tenant_model_service as model_resolver
from api.db.services.shared_model_service import SharedModelService


def test_shared_model_visibility_defaults_to_all(monkeypatch):
    stored = {"models": {}}
    monkeypatch.setattr(SharedModelService, "_load", classmethod(lambda cls: stored))
    monkeypatch.setattr(SharedModelService, "_save", classmethod(lambda cls, data: stored.update(data)))

    SharedModelService.set_access("model-1", created_by="admin-1")

    assert SharedModelService.can_use("personal-1", "model-1") is True
    assert SharedModelService.can_use("team-1", "model-1") is True


def test_shared_model_selected_visibility_is_workspace_scoped(monkeypatch):
    stored = {"models": {}}
    monkeypatch.setattr(SharedModelService, "_load", classmethod(lambda cls: stored))
    monkeypatch.setattr(SharedModelService, "_save", classmethod(lambda cls, data: stored.update(data)))

    SharedModelService.set_access(
        "model-1",
        visibility="selected",
        workspace_ids=["team-1", "personal-1", "team-1"],
    )

    assert SharedModelService.can_use("team-1", "model-1") is True
    assert SharedModelService.can_use("personal-1", "model-1") is True
    assert SharedModelService.can_use("team-2", "model-1") is False
    assert SharedModelService.get_entry("model-1")["workspace_ids"] == ["personal-1", "team-1"]


def test_model_config_by_id_enforces_shared_workspace_acl(monkeypatch):
    model = SimpleNamespace(
        id="model-1",
        provider_id="provider-1",
        instance_id="instance-1",
        model_name="shared-chat",
        model_type=1,
        status="active",
        extra='{"max_tokens": 4096}',
    )
    provider = SimpleNamespace(
        id="provider-1",
        provider_name="OpenAI-API-Compatible",
        tenant_id="admin-1",
    )
    instance = SimpleNamespace(
        id="instance-1",
        provider_id="provider-1",
        instance_name="shared",
        api_key="secret",
        extra='{"base_url": "http://llm.example/v1"}',
    )
    monkeypatch.setattr(model_resolver.TenantModelService, "get_by_id", lambda model_id: (True, model))
    monkeypatch.setattr(
        model_resolver.TenantModelProviderService,
        "get_by_id",
        lambda provider_id: (True, provider),
    )
    monkeypatch.setattr(
        model_resolver.TenantModelInstanceService,
        "get_by_id",
        lambda instance_id: (True, instance),
    )
    monkeypatch.setattr(
        model_resolver.TenantService,
        "list_accessible_by_user_id",
        lambda workspace_id: [],
    )
    monkeypatch.setattr(model_resolver.SharedModelService, "can_use", lambda workspace_id, model_id: False)

    with pytest.raises(LookupError, match="has no access"):
        model_resolver.get_model_config_by_id("team-2", "chat", "model-1")

    monkeypatch.setattr(model_resolver.SharedModelService, "can_use", lambda workspace_id, model_id: workspace_id == "team-1")
    config = model_resolver.get_model_config_by_id("team-1", "chat", "model-1")

    assert config == {
        "llm_factory": "OpenAI-API-Compatible",
        "api_key": "secret",
        "llm_name": "shared-chat",
        "api_base": "http://llm.example/v1",
        "model_type": "chat",
        "is_tools": None,
        "max_tokens": 4096,
    }


def test_validate_tenant_model_ids_rejects_inaccessible_model(monkeypatch):
    def reject(*_args, **_kwargs):
        raise LookupError("workspace cannot use model")

    monkeypatch.setattr(model_resolver, "get_model_config_by_id", reject)

    with pytest.raises(LookupError, match="workspace cannot use model"):
        model_resolver.validate_tenant_model_ids_for_params(
            "team-b",
            {"tenant_llm_id": "model-1"},
        )
