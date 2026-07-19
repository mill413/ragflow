import sys
from pathlib import Path
from types import SimpleNamespace

sys.path.insert(0, str(Path(__file__).parents[3] / "admin" / "server"))

from services import ResourceMgr, TenantService, UserService, UserServiceMgr


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

    resources = UserServiceMgr.get_user_resources("user@example.com")

    assert set(resources) == set(ResourceMgr.RESOURCE_SPECS)
    assert all(
        rows[0]["resource_type"] == resource_type
        for resource_type, rows in resources.items()
    )
    assert len(calls) == len(ResourceMgr.RESOURCE_SPECS)
    for _, kwargs in calls:
        assert kwargs["workspace_ids"] == ["user-1", "team-1"]
        assert kwargs["paginate"] is False
