import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[3] / "admin" / "server"))

import services
from services import ResourceMgr, TeamMgr, TenantService, UserService, UserServiceMgr


def test_get_user_resources_uses_all_accessible_workspaces(monkeypatch):
    user = SimpleNamespace(id="user-1")
    monkeypatch.setattr(UserService, "query_user_by_email", lambda email: [user])
    monkeypatch.setattr(
        TenantService,
        "list_accessible_by_user_id",
        lambda user_id: [
            {"tenant_id": "user-1"},
            {"tenant_id": "team-1"},
        ],
    )

    calls = []

    def list_resources(resource_type, **kwargs):
        calls.append((resource_type, kwargs))
        return {
            "resources": [
                {
                    "id": f"{resource_type}-1",
                    "resource_type": resource_type,
                }
            ]
        }

    monkeypatch.setattr(ResourceMgr, "list_resources", list_resources)
    monkeypatch.setattr(
        services,
        "_get_workspace_model_configuration",
        lambda workspace_id: {"workspace_id": workspace_id},
    )

    resources = UserServiceMgr.get_user_resources("user@example.com")

    assert set(resources) == {*ResourceMgr.RESOURCE_SPECS, "model"}
    assert all(
        rows[0]["resource_type"] == resource_type
        for resource_type, rows in resources.items()
        if resource_type != "model"
    )
    assert resources["model"] == {"workspace_id": "user-1"}
    assert len(calls) == len(ResourceMgr.RESOURCE_SPECS)
    for _, kwargs in calls:
        assert kwargs["workspace_ids"] == ["user-1", "team-1"]
        assert kwargs["paginate"] is False


def test_get_team_resources_uses_only_team_workspace(monkeypatch):
    monkeypatch.setattr(TeamMgr, "_ensure_team", lambda team_id: None)
    calls = []

    def list_resources(resource_type, **kwargs):
        calls.append((resource_type, kwargs))
        return {"resources": [{"resource_type": resource_type}]}

    monkeypatch.setattr(ResourceMgr, "list_resources", list_resources)
    monkeypatch.setattr(
        services,
        "_get_workspace_model_configuration",
        lambda workspace_id: {"workspace_id": workspace_id},
    )

    resources = TeamMgr.get_resources("team-1")

    assert set(resources) == {*ResourceMgr.RESOURCE_SPECS, "model"}
    assert resources["model"] == {"workspace_id": "team-1"}
    assert len(calls) == len(ResourceMgr.RESOURCE_SPECS)
    for resource_type, kwargs in calls:
        assert kwargs["workspace_ids"] == ["team-1"]
        assert kwargs["hierarchy"] is (resource_type == "file")
        assert kwargs["paginate"] is False
