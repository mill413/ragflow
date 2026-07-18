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

from api.db.services.resource_reference_service import ResourceReferenceService
from common.exceptions import ResourceInUseException


class _FakeQuery(list):
    def where(self, *_args, **_kwargs):
        return self


def test_extract_ids_finds_nested_references_and_ignores_variable_expressions():
    dsl = {
        "components": [
            {"mcp_id": "mcp-1"},
            {"nested": {"mcp_ids": ["mcp-2", "component@output", ""]}},
        ]
    }

    assert ResourceReferenceService._extract_ids(dsl, {"mcp_id", "mcp_ids"}) == {"mcp-1", "mcp-2"}


def test_find_references_deduplicates_and_sorts_by_type_and_name(monkeypatch):
    references = [
        ResourceReferenceService._reference("agent", "agent-2", "Zulu"),
        ResourceReferenceService._reference("agent", "agent-1", "Alpha"),
        ResourceReferenceService._reference("agent", "agent-1", "Duplicate name"),
    ]
    monkeypatch.setattr(
        ResourceReferenceService,
        "_mcp_references",
        classmethod(lambda cls, target: references),
    )

    target, result = ResourceReferenceService.find_references(
        "mcp",
        SimpleNamespace(id="mcp-1", name="Shared MCP", tenant_id="team-1"),
    )

    assert target == {
        "resource_type": "mcp",
        "resource_id": "mcp-1",
        "resource_name": "Shared MCP",
        "workspace_id": "team-1",
    }
    assert [(reference["resource_id"], reference["resource_name"]) for reference in result] == [
        ("agent-1", "Duplicate name"),
        ("agent-2", "Zulu"),
    ]


def test_ensure_not_referenced_reports_each_target_and_its_referrers(monkeypatch):
    def find_references(cls, resource_type, resource):
        target = cls._target(resource_type, resource)
        if target["resource_id"] == "mcp-unused":
            return target, []
        return target, [cls._reference("agent", "agent-1", "Research assistant")]

    monkeypatch.setattr(ResourceReferenceService, "find_references", classmethod(find_references))

    resources = [
        SimpleNamespace(id="mcp-used", name="Used MCP", tenant_id="team-1"),
        SimpleNamespace(id="mcp-unused", name="Unused MCP", tenant_id="team-1"),
    ]
    with pytest.raises(ResourceInUseException) as exc_info:
        ResourceReferenceService.ensure_not_referenced("mcp", resources)

    assert [target["resource_id"] for target in exc_info.value.targets] == ["mcp-used"]
    assert exc_info.value.references == [
        {
            "resource_type": "agent",
            "resource_id": "agent-1",
            "resource_name": "Research assistant",
            "target_resource_id": "mcp-used",
        }
    ]


def test_build_model_targets_includes_id_and_canonical_name(monkeypatch):
    provider = SimpleNamespace(id="provider-1", provider_name="OpenAI-API-Compatible", tenant_id="team-1")
    instance = SimpleNamespace(id="instance-1", instance_name="default", provider_id="provider-1")
    model = SimpleNamespace(id="model-1", model_name="chat-model", provider_id="provider-1", instance_id="instance-1")

    monkeypatch.setattr(
        "api.db.services.resource_reference_service.TenantModelProvider.select",
        lambda *_args: _FakeQuery([provider]),
    )
    monkeypatch.setattr(
        "api.db.services.resource_reference_service.TenantModelInstance.select",
        lambda *_args: _FakeQuery([instance]),
    )

    assert ResourceReferenceService.build_model_targets("team-1", [model]) == [
        {
            "id": "model-1",
            "name": "chat-model@default@OpenAI-API-Compatible",
            "tenant_id": "team-1",
            "identifiers": [
                "model-1",
                "chat-model@default@OpenAI-API-Compatible",
                "chat-model@OpenAI-API-Compatible",
            ],
        }
    ]


def test_model_reference_scanner_reports_chat_using_model_id(monkeypatch):
    monkeypatch.setattr(
        "api.db.services.resource_reference_service.Tenant.get_or_none",
        lambda *_args, **_kwargs: None,
    )
    empty_models = [
        "Knowledgebase",
        "Document",
        "Search",
        "Memory",
        "CompilationTemplate",
        "TenantModelGroupMapping",
        "TenantModelGroup",
        "UserCanvas",
        "UserCanvasVersion",
        "API4Conversation",
    ]
    for model_name in empty_models:
        monkeypatch.setattr(
            f"api.db.services.resource_reference_service.{model_name}.select",
            lambda *_args: _FakeQuery(),
        )
    monkeypatch.setattr(
        "api.db.services.resource_reference_service.Dialog.select",
        lambda *_args: _FakeQuery(
            [
                SimpleNamespace(
                    id="chat-1",
                    name="Team chat",
                    llm_id="model-1",
                    tenant_llm_id="model-1",
                    rerank_id="",
                    tenant_rerank_id=None,
                    llm_setting={},
                    prompt_config={},
                )
            ]
        ),
    )

    references = ResourceReferenceService._model_references(
        {
            "resource_id": "model-1",
            "workspace_id": "team-1",
            "identifiers": ["model-1", "chat-model@internal@OpenAI-API-Compatible"],
        }
    )

    assert references == [
        {
            "resource_type": "chat",
            "resource_id": "chat-1",
            "resource_name": "Team chat",
        }
    ]
