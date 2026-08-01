import sys
from pathlib import Path
from types import SimpleNamespace

import pytest

sys.path.insert(0, str(Path(__file__).parents[3] / "admin" / "server"))

import services
from api.common.exceptions import AdminException
from services import APITokenMgr


def build_token(**overrides):
    values = {
        "tenant_id": "personal-1",
        "token": "ragflow-super-secret-token-value",
        "source": None,
        "dialog_id": None,
        "create_date": None,
        "update_date": None,
        "update_time": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture
def workspaces(monkeypatch):
    data = {
        "personal-1": {
            "id": "personal-1",
            "name": "Alice",
            "type": "personal",
        },
        "team-1": {"id": "team-1", "name": "Platform", "type": "team"},
    }
    monkeypatch.setattr(APITokenMgr, "_workspace_map", lambda: data)
    return data


def test_list_tokens_returns_secrets_and_resolves_workspace(monkeypatch, workspaces):
    token = build_token()
    monkeypatch.setattr(
        services.APITokenService,
        "get_all",
        lambda **_kwargs: [token],
    )

    result = APITokenMgr.list_tokens()

    assert result == [
        {
            "id": APITokenMgr._token_id(token.token),
            "token": "ragflow-super-secret-token-value",
            "workspace_id": "personal-1",
            "workspace_name": "Alice",
            "workspace_type": "personal",
            "source": "workspace",
            "resource_id": None,
            "create_date": None,
            "update_date": None,
        }
    ]
    assert token.token in result[0].values()


def test_create_token_returns_secret_and_full_token(monkeypatch, workspaces):
    saved = []
    monkeypatch.setattr(
        services.APITokenService,
        "save",
        lambda **data: saved.append(data) or True,
    )

    result = APITokenMgr.create_token({"workspace_id": "team-1"})

    assert result["secret"].startswith("ragflow-")
    assert result["token"]["workspace_id"] == "team-1"
    assert result["token"]["token"] == result["secret"]
    assert saved[0]["token"] == result["secret"]


def test_create_token_rejects_unknown_workspace(workspaces):
    with pytest.raises(AdminException, match="Workspace not found"):
        APITokenMgr.create_token({"workspace_id": "missing"})


def test_delete_token_uses_opaque_identifier(monkeypatch):
    token = build_token()
    monkeypatch.setattr(
        services.APITokenService,
        "get_all",
        lambda **_kwargs: [token],
    )
    monkeypatch.setattr(
        services.APITokenService,
        "filter_delete",
        lambda conditions: len(conditions),
    )

    assert APITokenMgr.delete_token(APITokenMgr._token_id(token.token)) is True


def test_get_token_rejects_invalid_identifier():
    with pytest.raises(AdminException, match="API Token not found"):
        APITokenMgr.get_token("raw-secret")
