from api.apps.services import dataset_api_service


def _capture_knowledgebase_scope(monkeypatch):
    captured = {}

    def get_list(joined_tenant_ids, user_id, *_args, **_kwargs):
        captured["joined_tenant_ids"] = joined_tenant_ids
        captured["user_id"] = user_id
        return [], 0

    monkeypatch.setattr(dataset_api_service.KnowledgebaseService, "get_list", get_list)
    monkeypatch.setattr(dataset_api_service.TenantService, "get_by_ids", lambda _ids: [])
    monkeypatch.setattr(dataset_api_service.UserService, "get_by_ids", lambda _ids: [])
    monkeypatch.setattr(dataset_api_service.WorkspaceAccessService, "is_superuser", lambda _user_id: False)
    monkeypatch.setattr(
        dataset_api_service.WorkspaceAccessService,
        "list_visible_workspace_ids",
        lambda _user_id: ["user-1", "team-1"],
    )
    return captured


def test_list_datasets_team_owner_filter_excludes_personal_workspace(monkeypatch):
    captured = _capture_knowledgebase_scope(monkeypatch)

    success, result = dataset_api_service.list_datasets("user-1", {"ext": {"owner_ids": ["team-1"]}})

    assert success
    assert result == {"data": [], "total": 0}
    assert captured == {
        "joined_tenant_ids": ["team-1"],
        "user_id": "",
    }


def test_list_datasets_owner_filter_includes_personal_only_when_requested(monkeypatch):
    captured = _capture_knowledgebase_scope(monkeypatch)

    success, result = dataset_api_service.list_datasets("user-1", {"ext": {"owner_ids": ["user-1", "team-1"]}})

    assert success
    assert result == {"data": [], "total": 0}
    assert captured == {
        "joined_tenant_ids": ["team-1"],
        "user_id": "user-1",
    }
