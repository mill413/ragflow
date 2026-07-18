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
