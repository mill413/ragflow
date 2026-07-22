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

from api.db.services.workspace_parser_service import WorkspaceParserService


def test_regular_builtin_chunk_methods_do_not_require_workspace_grant():
    assert WorkspaceParserService.is_allowed("missing-workspace", "naive")


def test_extended_chunk_method_requires_workspace_grant(monkeypatch):
    tenant = SimpleNamespace(parser_ids="naive:General,qa:Q&A")
    monkeypatch.setattr(
        "api.db.services.workspace_parser_service.TenantService.get_by_id",
        lambda _workspace_id: (True, tenant),
    )

    assert not WorkspaceParserService.is_allowed("workspace-1", "custom_chunk")
    with pytest.raises(PermissionError):
        WorkspaceParserService.require_allowed("workspace-1", "custom_chunk")


def test_extended_chunk_method_can_be_enabled_and_disabled(monkeypatch):
    tenant = SimpleNamespace(parser_ids="naive:General,qa:Q&A")
    updates = []
    monkeypatch.setattr(
        "api.db.services.workspace_parser_service.TenantService.get_by_id",
        lambda _workspace_id: (True, tenant),
    )

    def update_by_id(_workspace_id, values):
        tenant.parser_ids = values["parser_ids"]
        updates.append(values)

    monkeypatch.setattr(
        "api.db.services.workspace_parser_service.TenantService.update_by_id",
        update_by_id,
    )

    WorkspaceParserService.set_enabled("workspace-1", "custom_chunk", True)
    assert WorkspaceParserService.is_allowed("workspace-1", "custom_chunk")
    assert tenant.parser_ids.endswith("custom_chunk:Custom Chunk")

    WorkspaceParserService.set_enabled("workspace-1", "custom_chunk", False)
    assert not WorkspaceParserService.is_allowed("workspace-1", "custom_chunk")
    assert "custom_chunk" not in tenant.parser_ids
    assert len(updates) == 2
