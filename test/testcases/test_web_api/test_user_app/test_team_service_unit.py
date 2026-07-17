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
    monkeypatch.setattr(WorkspaceAccessService, "get_membership", classmethod(lambda _cls, _user, _team: membership))
    monkeypatch.setattr("api.db.services.workspace_service.UserTenantService.update_by_id", lambda row_id, data: updates.append((row_id, data)))
    monkeypatch.setattr(TeamService, "get", classmethod(lambda _cls, user_id, team_id: {"tenant_id": team_id, "user_id": user_id}))

    result = TeamService.accept_invitation("user-1", "team-1")
    assert result["tenant_id"] == "team-1"
    assert updates == [("membership-1", {"role": UserTenantRole.NORMAL})]

    membership.role = UserTenantRole.OWNER
    with pytest.raises(ValueError, match="Transfer team ownership"):
        TeamService.remove_member("user-1", "team-1", "user-1")


def test_normal_member_cannot_change_roles(monkeypatch):
    monkeypatch.setattr(WorkspaceAccessService, "can_manage_workspace", classmethod(lambda _cls, _user, _team: False))
    with pytest.raises(PermissionError):
        TeamService.update_member_role("member-1", "team-1", "member-2", UserTenantRole.ADMIN)


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
