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
from quart import Quart, g

from api.apps.workspace_access import workspace_required
from api.db import TenantPermission, UserTenantRole, WorkspaceType
from api.db.services.workspace_service import WorkspaceAccessService
from common.constants import StatusEnum


@pytest.fixture
def workspace_dependencies(monkeypatch):
    tenants = {
        "user-1": SimpleNamespace(id="user-1", name="User 1's Kingdom", status=StatusEnum.VALID.value),
        "team-1": SimpleNamespace(id="team-1", name="Team 1", status=StatusEnum.VALID.value),
    }
    users = {
        "user-1": SimpleNamespace(id="user-1", nickname="User 1", status=StatusEnum.VALID.value),
        "creator-1": SimpleNamespace(id="creator-1", nickname="Creator 1", status=StatusEnum.VALID.value),
    }
    memberships = {
        ("user-1", "user-1"): SimpleNamespace(user_id="user-1", tenant_id="user-1", role=UserTenantRole.OWNER, status=StatusEnum.VALID.value),
        ("owner-1", "team-1"): SimpleNamespace(user_id="owner-1", tenant_id="team-1", role=UserTenantRole.OWNER, status=StatusEnum.VALID.value),
        ("admin-1", "team-1"): SimpleNamespace(user_id="admin-1", tenant_id="team-1", role=UserTenantRole.ADMIN, status=StatusEnum.VALID.value),
        ("member-1", "team-1"): SimpleNamespace(user_id="member-1", tenant_id="team-1", role=UserTenantRole.NORMAL, status=StatusEnum.VALID.value),
        ("member-2", "team-1"): SimpleNamespace(user_id="member-2", tenant_id="team-1", role=UserTenantRole.NORMAL, status=StatusEnum.VALID.value),
        ("invite-1", "team-1"): SimpleNamespace(user_id="invite-1", tenant_id="team-1", role=UserTenantRole.INVITE, status=StatusEnum.VALID.value),
    }

    monkeypatch.setattr(WorkspaceAccessService, "get_membership", classmethod(lambda cls, user_id, tenant_id: memberships.get((user_id, tenant_id))))
    monkeypatch.setattr(
        "api.db.services.workspace_service.TenantService.get_by_id",
        lambda tenant_id: (tenant_id in tenants, tenants.get(tenant_id)),
    )
    monkeypatch.setattr(
        "api.db.services.workspace_service.UserService.get_by_id",
        lambda user_id: (user_id in users, users.get(user_id)),
    )
    monkeypatch.setattr(
        "api.db.services.workspace_service.UserService.is_admin",
        lambda user_id: user_id == "system-admin",
    )
    monkeypatch.setattr(
        "api.db.services.workspace_service.UserTenantService.query",
        lambda **kwargs: [
            membership for membership in memberships.values() if membership.tenant_id == kwargs["tenant_id"] and membership.role == kwargs["role"] and membership.status == kwargs["status"]
        ],
    )

    return memberships


def test_workspace_type_distinguishes_personal_team_and_missing(workspace_dependencies):
    assert WorkspaceAccessService.get_workspace_type("user-1") == WorkspaceType.PERSONAL
    assert WorkspaceAccessService.get_workspace_type("team-1") == WorkspaceType.TEAM
    assert WorkspaceAccessService.get_workspace_type("missing") is None
    assert WorkspaceAccessService.get_workspace_owner_id("user-1") == "user-1"
    assert WorkspaceAccessService.get_workspace_owner_id("team-1") == "owner-1"


def test_resource_workspace_metadata_uses_personal_owner_as_missing_creator(workspace_dependencies):
    metadata = WorkspaceAccessService.get_resource_workspace_metadata({"tenant_id": "user-1"})

    assert metadata == {
        "workspace_type": WorkspaceType.PERSONAL,
        "workspace_name": "User 1's Kingdom",
        "creator_name": "User 1",
    }


def test_resource_workspace_metadata_prefers_recorded_creator(workspace_dependencies):
    metadata = WorkspaceAccessService.get_resource_workspace_metadata(
        {"tenant_id": "user-1", "created_by": "creator-1"}
    )

    assert metadata["creator_name"] == "Creator 1"


def test_invitation_is_not_an_active_membership(workspace_dependencies):
    assert WorkspaceAccessService.is_member("member-1", "team-1")
    assert not WorkspaceAccessService.is_member("invite-1", "team-1")
    assert not WorkspaceAccessService.is_member("outsider", "team-1")


def test_only_team_owner_and_admin_can_manage_workspace(workspace_dependencies):
    assert WorkspaceAccessService.can_manage_workspace("owner-1", "team-1")
    assert WorkspaceAccessService.can_manage_workspace("admin-1", "team-1")
    assert not WorkspaceAccessService.can_manage_workspace("member-1", "team-1")
    assert not WorkspaceAccessService.can_manage_workspace("user-1", "user-1")


def test_shared_resource_permissions_follow_workspace_roles(workspace_dependencies):
    personal_resource = {"tenant_id": "user-1", "status": StatusEnum.VALID.value}
    team_resource = {"tenant_id": "team-1", "status": StatusEnum.VALID.value}
    team_agent = {"user_id": "team-1", "permission": TenantPermission.TEAM}

    assert WorkspaceAccessService.can_create_shared_resource("user-1", "user-1")
    assert WorkspaceAccessService.can_create_shared_resource("owner-1", "team-1")
    assert WorkspaceAccessService.can_create_shared_resource("admin-1", "team-1")
    assert not WorkspaceAccessService.can_create_shared_resource("member-1", "team-1")
    assert WorkspaceAccessService.can_create_shared_resource("system-admin", "team-1")

    assert WorkspaceAccessService.get_shared_resource_capabilities("user-1", personal_resource) == {
        "read": True,
        "update": True,
        "delete": True,
    }
    assert WorkspaceAccessService.get_shared_resource_capabilities("member-1", team_resource) == {
        "read": True,
        "update": False,
        "delete": False,
    }
    assert WorkspaceAccessService.get_shared_resource_capabilities("admin-1", team_resource) == {
        "read": True,
        "update": True,
        "delete": True,
    }
    assert WorkspaceAccessService.get_shared_resource_capabilities(
        "member-1",
        team_agent,
        workspace_field="user_id",
        permission_field="permission",
    )["read"]
    assert not WorkspaceAccessService.can_read_shared_resource("outsider", team_resource)


def test_superuser_can_read_and_manage_every_workspace_resource(workspace_dependencies):
    personal_resource = {"tenant_id": "user-1", "status": StatusEnum.VALID.value}
    team_resource = {"tenant_id": "team-1", "status": StatusEnum.VALID.value}

    assert WorkspaceAccessService.can_read_shared_resource("system-admin", personal_resource)
    assert WorkspaceAccessService.can_read_shared_resource("system-admin", team_resource)
    assert WorkspaceAccessService.can_manage_shared_resource("system-admin", personal_resource)
    assert WorkspaceAccessService.can_manage_shared_resource("system-admin", team_resource)


@pytest.mark.asyncio
async def test_superuser_can_write_another_users_personal_workspace(workspace_dependencies):
    app = Quart(__name__)

    @workspace_required(write=True)
    async def update_personal_workspace(tenant_id):
        return tenant_id

    async with app.test_request_context("/?workspace_id=user-1"):
        assert await update_personal_workspace(tenant_id="system-admin") == "user-1"


@pytest.mark.asyncio
async def test_api_token_scope_blocks_other_workspaces(workspace_dependencies):
    app = Quart(__name__)
    team_resource = {"tenant_id": "team-1", "status": StatusEnum.VALID.value}
    personal_resource = {"tenant_id": "user-1", "status": StatusEnum.VALID.value}

    async with app.test_request_context("/"):
        g.api_token_workspace_id = "team-1"
        assert WorkspaceAccessService.can_read_shared_resource("system-admin", team_resource)
        assert not WorkspaceAccessService.can_read_shared_resource("system-admin", personal_resource)
        assert not WorkspaceAccessService.can_create_shared_resource("system-admin", "user-1")


def test_knowledgebase_permissions_follow_workspace_and_creator_roles(workspace_dependencies):
    personal_kb = {
        "tenant_id": "user-1",
        "created_by": "user-1",
        "permission": TenantPermission.ME,
        "status": StatusEnum.VALID.value,
    }
    team_kb = {
        "tenant_id": "team-1",
        "created_by": "member-1",
        "permission": TenantPermission.TEAM,
        "status": StatusEnum.VALID.value,
    }

    assert WorkspaceAccessService.get_knowledgebase_capabilities("user-1", personal_kb) == {"read": True, "update": True, "delete": True}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("outsider", personal_kb) == {"read": False, "update": False, "delete": False}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("member-1", team_kb) == {"read": True, "update": False, "delete": False}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("member-2", team_kb) == {"read": True, "update": False, "delete": False}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("admin-1", team_kb) == {"read": True, "update": True, "delete": True}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("invite-1", team_kb) == {"read": False, "update": False, "delete": False}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("outsider", team_kb) == {"read": False, "update": False, "delete": False}
    assert WorkspaceAccessService.get_knowledgebase_capabilities("system-admin", personal_kb) == {
        "read": True,
        "update": True,
        "delete": True,
    }
    assert WorkspaceAccessService.get_knowledgebase_capabilities("system-admin", team_kb) == {
        "read": True,
        "update": True,
        "delete": True,
    }


def test_workspace_capabilities_distinguish_member_and_manager(workspace_dependencies):
    assert WorkspaceAccessService.get_workspace_capabilities("owner-1", "team-1") == {
        "read": True,
        "create_knowledgebase": True,
        "create_shared_resource": True,
        "manage_members": True,
        "update": True,
        "delete": True,
    }
    assert WorkspaceAccessService.get_workspace_capabilities("member-1", "team-1") == {
        "read": True,
        "create_knowledgebase": False,
        "create_shared_resource": False,
        "manage_members": False,
        "update": False,
        "delete": False,
    }
    assert WorkspaceAccessService.get_workspace_capabilities("system-admin", "team-1") == {
        "read": True,
        "create_knowledgebase": True,
        "create_shared_resource": True,
        "manage_members": True,
        "update": True,
        "delete": True,
    }


def test_team_members_cannot_create_or_modify_team_resources(workspace_dependencies):
    team_file = {"tenant_id": "team-1"}
    personal_file = {"tenant_id": "user-1"}

    assert not WorkspaceAccessService.can_create_knowledgebase("member-1", "team-1")
    assert not WorkspaceAccessService.can_create_shared_resource("member-1", "team-1")
    assert not WorkspaceAccessService.can_manage_file("member-1", team_file)
    assert WorkspaceAccessService.can_manage_file("admin-1", team_file)
    assert WorkspaceAccessService.can_manage_file("system-admin", team_file)
    assert WorkspaceAccessService.can_manage_file("user-1", personal_file)


def test_knowledgebase_references_must_stay_in_workspace(workspace_dependencies, monkeypatch):
    knowledgebases = {
        "team-kb": SimpleNamespace(
            id="team-kb",
            tenant_id="team-1",
            permission=TenantPermission.TEAM,
            status=StatusEnum.VALID.value,
        ),
        "personal-kb": SimpleNamespace(
            id="personal-kb",
            tenant_id="user-1",
            permission=TenantPermission.ME,
            status=StatusEnum.VALID.value,
        ),
    }
    monkeypatch.setattr(
        "api.db.services.workspace_service.Knowledgebase.get_or_none",
        lambda *_args, **_kwargs: knowledgebases.get(_kwargs.get("id")),
    )

    assert WorkspaceAccessService.extract_knowledgebase_ids({"components": [{"params": {"dataset_ids": ["team-kb"]}}]}) == {"team-kb"}
    assert WorkspaceAccessService.can_reference_knowledgebases("member-1", "team-1", ["team-kb"])
    assert not WorkspaceAccessService.can_reference_knowledgebases("member-1", "team-1", ["personal-kb"])
    assert not WorkspaceAccessService.can_reference_knowledgebases("member-1", "team-1", ["missing"])


def test_workspace_resources_are_readable_by_members_and_writable_by_managers(workspace_dependencies, monkeypatch):
    monkeypatch.setattr(
        WorkspaceAccessService,
        "list_visible_workspace_ids",
        classmethod(lambda cls, user_id: ["team-1"] if user_id in {"member-1", "admin-1", "system-admin"} else []),
    )
    resource = {"tenant_id": "team-1"}

    assert WorkspaceAccessService.get_workspace_resource_capabilities("member-1", resource) == {
        "read": True,
        "update": False,
        "delete": False,
    }
    assert WorkspaceAccessService.get_workspace_resource_capabilities("admin-1", resource) == {
        "read": True,
        "update": True,
        "delete": True,
    }
    assert WorkspaceAccessService.get_workspace_resource_capabilities("system-admin", resource) == {
        "read": True,
        "update": True,
        "delete": True,
    }


def test_connector_mcp_and_compilation_references_must_stay_in_workspace(workspace_dependencies, monkeypatch):
    connectors = {
        "team-connector": SimpleNamespace(id="team-connector", tenant_id="team-1"),
        "personal-connector": SimpleNamespace(id="personal-connector", tenant_id="user-1"),
    }
    mcp_servers = {
        "team-mcp": SimpleNamespace(id="team-mcp", tenant_id="team-1"),
        "personal-mcp": SimpleNamespace(id="personal-mcp", tenant_id="user-1"),
    }
    groups = {
        "team-group": SimpleNamespace(id="team-group", tenant_id="team-1", status=StatusEnum.VALID.value),
        "personal-group": SimpleNamespace(id="personal-group", tenant_id="user-1", status=StatusEnum.VALID.value),
    }
    monkeypatch.setattr(WorkspaceAccessService, "list_visible_workspace_ids", classmethod(lambda cls, user_id: ["team-1"]))
    monkeypatch.setattr(
        "api.db.services.workspace_service.Connector.get_or_none",
        lambda *_args, **kwargs: connectors.get(kwargs.get("id")),
    )
    monkeypatch.setattr(
        "api.db.services.workspace_service.MCPServer.get_or_none",
        lambda *_args, **kwargs: mcp_servers.get(kwargs.get("id")),
    )
    monkeypatch.setattr(
        "api.db.services.workspace_service.CompilationTemplateGroup.get_or_none",
        lambda *_args, **kwargs: groups.get(kwargs.get("id")),
    )

    assert WorkspaceAccessService.extract_reference_ids(
        {"mcp": [{"mcp_id": "team-mcp"}], "compilation_template_group_ids": ["team-group"]},
        {"mcp_id", "compilation_template_group_ids"},
    ) == {"team-mcp", "team-group"}
    assert WorkspaceAccessService.can_reference_connectors("member-1", "team-1", ["team-connector"])
    assert not WorkspaceAccessService.can_reference_connectors("member-1", "team-1", ["personal-connector"])
    assert WorkspaceAccessService.can_reference_mcp_servers("member-1", "team-1", ["team-mcp"])
    assert not WorkspaceAccessService.can_reference_mcp_servers("member-1", "team-1", ["personal-mcp"])
    assert WorkspaceAccessService.can_reference_compilation_template_groups("member-1", "team-1", ["team-group"])
    assert not WorkspaceAccessService.can_reference_compilation_template_groups("member-1", "team-1", ["personal-group"])


def test_memory_and_static_file_references_must_stay_in_workspace(workspace_dependencies, monkeypatch):
    memories = {
        "team-memory": SimpleNamespace(id="team-memory", tenant_id="team-1"),
        "personal-memory": SimpleNamespace(id="personal-memory", tenant_id="user-1"),
    }
    files = {
        "team-file": SimpleNamespace(id="team-file", tenant_id="team-1"),
        "personal-file": SimpleNamespace(id="personal-file", tenant_id="user-1"),
    }
    monkeypatch.setattr(WorkspaceAccessService, "list_visible_workspace_ids", classmethod(lambda cls, user_id: ["team-1"]))
    monkeypatch.setattr(
        "api.db.services.workspace_service.Memory.get_or_none",
        lambda *_args, **kwargs: memories.get(kwargs.get("id")),
    )
    monkeypatch.setattr(
        "api.db.services.workspace_service.File.get_or_none",
        lambda *_args, **kwargs: files.get(kwargs.get("id")),
    )

    dsl = {
        "components": [
            {"params": {"memory_ids": ["team-memory"]}},
            {
                "params": {
                    "upload_sources": "team-file,https://example.com/a,b.pdf,{Begin@files}",
                    "input_files": ["{Begin@excel}", {"file_id": "team-file"}],
                }
            },
        ]
    }

    assert WorkspaceAccessService.extract_reference_ids(dsl, {"memory_id", "memory_ids"}) == {"team-memory"}
    assert WorkspaceAccessService.extract_static_file_ids(dsl) == {"team-file"}
    assert WorkspaceAccessService.can_reference_memories("member-1", "team-1", ["team-memory"])
    assert not WorkspaceAccessService.can_reference_memories("member-1", "team-1", ["personal-memory"])
    assert WorkspaceAccessService.can_reference_files("member-1", "team-1", ["team-file"])
    assert not WorkspaceAccessService.can_reference_files("member-1", "team-1", ["personal-file"])


def test_team_conversations_are_shared_and_managed_by_team_administrators(workspace_dependencies):
    team_chat = {"id": "chat-1", "tenant_id": "team-1", "status": StatusEnum.VALID.value}
    member_conversation = {"id": "conv-1", "dialog_id": "chat-1", "user_id": "member-1"}

    assert WorkspaceAccessService.can_read_conversation("member-2", team_chat, member_conversation)
    assert not WorkspaceAccessService.can_manage_conversation("member-2", team_chat, member_conversation)
    assert WorkspaceAccessService.can_manage_conversation("member-1", team_chat, member_conversation)
    assert WorkspaceAccessService.can_manage_conversation("admin-1", team_chat, member_conversation)
    assert WorkspaceAccessService.can_manage_conversation("system-admin", team_chat, member_conversation)


def test_personal_conversations_are_visible_to_owner_and_superuser(workspace_dependencies):
    personal_chat = {"id": "chat-1", "tenant_id": "user-1", "status": StatusEnum.VALID.value}
    conversation = {"id": "conv-1", "dialog_id": "chat-1", "user_id": "user-1"}

    assert WorkspaceAccessService.can_manage_conversation("user-1", personal_chat, conversation)
    assert WorkspaceAccessService.can_manage_conversation("system-admin", personal_chat, conversation)
    assert not WorkspaceAccessService.can_read_conversation("member-1", personal_chat, conversation)


def test_team_agent_sessions_are_shared_and_managed_by_team_administrators(workspace_dependencies):
    team_agent = {"id": "agent-1", "user_id": "team-1", "permission": TenantPermission.TEAM}
    member_session = {"id": "session-1", "dialog_id": "agent-1", "user_id": "member-1"}

    assert WorkspaceAccessService.can_read_agent_session("member-2", team_agent, member_session)
    assert not WorkspaceAccessService.can_manage_agent_session("member-2", team_agent, member_session)
    assert WorkspaceAccessService.can_manage_agent_session("member-1", team_agent, member_session)
    assert WorkspaceAccessService.can_manage_agent_session("admin-1", team_agent, member_session)
    assert WorkspaceAccessService.can_manage_agent_session("system-admin", team_agent, member_session)
    assert not WorkspaceAccessService.can_read_agent_session("outsider", team_agent, member_session)
    assert not WorkspaceAccessService.can_read_agent_session("member-2", team_agent, {**member_session, "dialog_id": "agent-2"})


def test_personal_agent_sessions_are_visible_to_owner_and_superuser(workspace_dependencies):
    personal_agent = {"id": "agent-1", "user_id": "user-1", "permission": TenantPermission.ME}
    session = {"id": "session-1", "dialog_id": "agent-1", "user_id": "user-1"}

    assert WorkspaceAccessService.can_manage_agent_session("user-1", personal_agent, session)
    assert WorkspaceAccessService.can_manage_agent_session("system-admin", personal_agent, session)
    assert not WorkspaceAccessService.can_read_agent_session("member-1", personal_agent, session)
