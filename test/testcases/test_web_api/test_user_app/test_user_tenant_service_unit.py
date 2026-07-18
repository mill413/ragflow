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

import pytest
from peewee import SqliteDatabase

from api.db import UserTenantRole
from api.db.db_models import Tenant, User, UserTenant
from api.db.services.user_service import TenantService, UserTenantService
from common.constants import StatusEnum


def _call_without_connection_context(bound_method, service_class, *args):
    return bound_method.__wrapped__(service_class, *args)


def _create_tenant(tenant_id: str, name: str):
    return Tenant.create(
        id=tenant_id,
        name=name,
        llm_id="chat-model",
        embd_id="embedding-model",
        asr_id="asr-model",
        img2txt_id="vision-model",
        rerank_id="rerank-model",
        parser_ids="naive",
        status=StatusEnum.VALID.value,
    )


@pytest.fixture
def workspace_database():
    database = SqliteDatabase(":memory:")
    models = [User, Tenant, UserTenant]
    with database.bind_ctx(models):
        database.create_tables(models)
        User.create(id="user-1", nickname="User One", email="user-1@example.com", status=StatusEnum.VALID.value)
        User.create(id="owner-1", nickname="Owner One", email="owner-1@example.com", status=StatusEnum.VALID.value)
        User.create(id="invite-1", nickname="Invite One", email="invite-1@example.com", status=StatusEnum.VALID.value)

        _create_tenant("user-1", "Personal Workspace")
        _create_tenant("team-1", "Independent Team")
        _create_tenant("team-2", "Invited Team")

        UserTenant.create(id="membership-1", user_id="user-1", tenant_id="user-1", invited_by="user-1", role=UserTenantRole.OWNER, status=StatusEnum.VALID.value)
        UserTenant.create(id="membership-2", user_id="owner-1", tenant_id="team-1", invited_by="owner-1", role=UserTenantRole.OWNER, status=StatusEnum.VALID.value)
        UserTenant.create(id="membership-3", user_id="user-1", tenant_id="team-1", invited_by="owner-1", role=UserTenantRole.ADMIN, status=StatusEnum.VALID.value)
        UserTenant.create(id="membership-4", user_id="owner-1", tenant_id="team-2", invited_by="owner-1", role=UserTenantRole.OWNER, status=StatusEnum.VALID.value)
        UserTenant.create(id="membership-5", user_id="user-1", tenant_id="team-2", invited_by="owner-1", role=UserTenantRole.INVITE, status=StatusEnum.VALID.value)
        UserTenant.create(id="membership-6", user_id="invite-1", tenant_id="team-1", invited_by="owner-1", role=UserTenantRole.INVITE, status=StatusEnum.VALID.value)
        yield
        database.drop_tables(models)
        database.close()


def test_list_accessible_workspaces_includes_all_active_roles_but_not_invites(workspace_database):
    workspaces = _call_without_connection_context(TenantService.list_accessible_by_user_id, TenantService, "user-1")

    assert [(workspace["tenant_id"], workspace["role"]) for workspace in workspaces] == [
        ("user-1", UserTenantRole.OWNER),
        ("team-1", UserTenantRole.ADMIN),
    ]


def test_personal_workspace_query_does_not_return_independent_team(workspace_database):
    personal = _call_without_connection_context(TenantService.get_personal_by_user_id, TenantService, "user-1")
    team_owner_personal = _call_without_connection_context(TenantService.get_personal_by_user_id, TenantService, "owner-1")

    assert personal["tenant_id"] == "user-1"
    assert team_owner_personal is None


def test_membership_list_joins_tenant_instead_of_assuming_tenant_is_user(workspace_database):
    memberships = _call_without_connection_context(UserTenantService.list_memberships_by_user_id, UserTenantService, "user-1")

    assert {(membership["tenant_id"], membership["name"], membership["role"]) for membership in memberships} == {
        ("user-1", "Personal Workspace", UserTenantRole.OWNER),
        ("team-1", "Independent Team", UserTenantRole.ADMIN),
        ("team-2", "Invited Team", UserTenantRole.INVITE),
    }


def test_member_listing_includes_owner_admin_and_invitation(workspace_database):
    members = _call_without_connection_context(UserTenantService.get_by_tenant_id, UserTenantService, "team-1")

    assert {(member["user_id"], member["role"]) for member in members} == {
        ("owner-1", UserTenantRole.OWNER),
        ("user-1", UserTenantRole.ADMIN),
        ("invite-1", UserTenantRole.INVITE),
    }


def test_member_count_excludes_pending_invitations(workspace_database):
    count = _call_without_connection_context(UserTenantService.get_num_members, UserTenantService, "team-1")

    assert count == 2
