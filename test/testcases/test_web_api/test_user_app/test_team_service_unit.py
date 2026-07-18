from contextlib import nullcontext
from types import SimpleNamespace

import pytest

from api.db import UserTenantRole
from api.db.services.workspace_service import TeamService, WorkspaceAccessService
from common.constants import StatusEnum


@pytest.fixture(autouse=True)
def database_contexts(monkeypatch):
    monkeypatch.setattr("api.db.services.workspace_service.DB.atomic", nullcontext)
    monkeypatch.setattr("api.db.services.workspace_service.DB.lock", lambda *_args: nullcontext())


def test_invitation_acceptance_and_member_removal_are_role_safe(monkeypatch):
    membership = SimpleNamespace(id="membership-1", role=UserTenantRole.INVITE, status=StatusEnum.VALID.value)
    updates = []

    class UpdateQuery:
        def __init__(self, data):
            self.data = data

        def where(self, *_args):
            return self

        def execute(self):
            updates.append(self.data)

    monkeypatch.setattr(WorkspaceAccessService, "get_membership", classmethod(lambda _cls, _user, _team: membership))
    monkeypatch.setattr("api.db.services.workspace_service.UserTenant.update", lambda **data: UpdateQuery(data))
    monkeypatch.setattr(TeamService, "get", classmethod(lambda _cls, user_id, team_id: {"tenant_id": team_id, "user_id": user_id}))

    result = TeamService.accept_invitation("user-1", "team-1")
    assert result["tenant_id"] == "team-1"
    assert updates == [{"role": UserTenantRole.NORMAL}]

    membership.role = UserTenantRole.OWNER
    with pytest.raises(ValueError, match="Transfer team ownership"):
        TeamService.remove_member("user-1", "team-1", "user-1")


def test_normal_member_cannot_change_roles(monkeypatch):
    monkeypatch.setattr(WorkspaceAccessService, "can_manage_workspace", classmethod(lambda _cls, _user, _team: False))
    with pytest.raises(PermissionError):
        TeamService.update_member_role("member-1", "team-1", "member-2", UserTenantRole.ADMIN)


def test_superuser_can_view_teams_without_membership(monkeypatch):
    monkeypatch.setattr(WorkspaceAccessService, "is_superuser", staticmethod(lambda user_id: user_id == "root"))
    monkeypatch.setattr(
        WorkspaceAccessService,
        "list_visible_workspaces",
        classmethod(
            lambda _cls, _user_id: [
                {"tenant_id": "personal-1", "workspace_type": "personal"},
                {"tenant_id": "team-1", "workspace_type": "team"},
            ]
        ),
    )

    assert TeamService.list_by_user_id("root") == [{"tenant_id": "team-1", "workspace_type": "team"}]


def test_superuser_can_remove_non_owner_team_member(monkeypatch):
    member = SimpleNamespace(id="member-relation", role=UserTenantRole.ADMIN)
    updates = []

    class UpdateQuery:
        def where(self, *_args):
            return self

        def execute(self):
            updates.append(True)

    monkeypatch.setattr(
        WorkspaceAccessService,
        "get_membership",
        classmethod(lambda _cls, user_id, _team_id: member if user_id == "member-1" else None),
    )
    monkeypatch.setattr(WorkspaceAccessService, "is_superuser", staticmethod(lambda user_id: user_id == "root"))
    monkeypatch.setattr("api.db.services.workspace_service.UserTenant.update", lambda **_data: UpdateQuery())

    TeamService.remove_member("root", "team-1", "member-1")
    assert updates == [True]


def test_pending_invitations_are_separate_from_active_teams(monkeypatch):
    monkeypatch.setattr(
        "api.db.services.workspace_service.UserTenantService.list_memberships_by_user_id",
        lambda _user_id: [
            {"tenant_id": "team-1", "name": "Platform", "role": UserTenantRole.INVITE, "status": StatusEnum.VALID.value, "invited_by": "owner-1"},
            {"tenant_id": "team-2", "name": "Search", "role": UserTenantRole.NORMAL, "status": StatusEnum.VALID.value, "invited_by": "owner-2"},
        ],
    )
    monkeypatch.setattr(WorkspaceAccessService, "get_workspace_type", classmethod(lambda _cls, _team: "team"))

    assert TeamService.list_invitations("user-1") == [
        {
            "tenant_id": "team-1",
            "name": "Platform",
            "role": UserTenantRole.INVITE,
            "invited_by": "owner-1",
            "workspace_type": "team",
        }
    ]


def test_database_lock_names_fit_mysql_limit():
    lock_name = TeamService._lock_name("member", "a" * 32, "b" * 32)
    assert len(lock_name) <= 64
    assert lock_name == TeamService._lock_name("member", "a" * 32, "b" * 32)
