import asyncio
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace


class _Manager:
    def route(self, *_args, **_kwargs):
        return lambda function: function


class _Awaitable:
    def __init__(self, value):
        self.value = value

    def __await__(self):
        async def value():
            return self.value

        return value().__await__()


def _load(monkeypatch):
    repo_root = Path(__file__).resolve().parents[4]
    apps = ModuleType("api.apps")
    apps.current_user = SimpleNamespace(id="user-1", email="owner@example.com", nickname="Owner")
    apps.login_required = lambda function: function
    monkeypatch.setitem(sys.modules, "api.apps", apps)

    workspace = ModuleType("api.db.services.workspace_service")
    workspace.TeamService = SimpleNamespace()
    monkeypatch.setitem(sys.modules, "api.db.services.workspace_service", workspace)

    api_utils = ModuleType("api.utils.api_utils")
    api_utils.get_json_result = lambda data=None, message="", code=0: {"code": code, "message": message, "data": data}
    api_utils.get_request_json = lambda: _Awaitable({})
    api_utils.server_error_response = lambda exc: {"code": 500, "message": str(exc), "data": False}
    api_utils.validate_request = lambda *_args: lambda function: function
    monkeypatch.setitem(sys.modules, "api.utils.api_utils", api_utils)

    web_utils = ModuleType("api.utils.web_utils")
    web_utils.send_invite_email = lambda **_kwargs: _Awaitable(True)
    monkeypatch.setitem(sys.modules, "api.utils.web_utils", web_utils)

    common = ModuleType("common")
    common.settings = SimpleNamespace(MAIL_FRONTEND_URL="https://example.test/invite")
    monkeypatch.setitem(sys.modules, "common", common)
    constants = ModuleType("common.constants")
    constants.RetCode = SimpleNamespace(FORBIDDEN=403, NOT_FOUND=404, ARGUMENT_ERROR=400)
    monkeypatch.setitem(sys.modules, "common.constants", constants)

    module_path = repo_root / "api/apps/restful_apis/tenant_api.py"
    spec = importlib.util.spec_from_file_location("team_api_unit", module_path)
    module = importlib.util.module_from_spec(spec)
    module.manager = _Manager()
    spec.loader.exec_module(module)
    return module


def test_team_crud_routes_delegate_to_service(monkeypatch):
    module = _load(monkeypatch)
    module.TeamService.create = lambda user_id, name: {"tenant_id": "team-1", "name": name, "owner": user_id}
    module.TeamService.list_by_user_id = lambda user_id: [{"tenant_id": "team-1", "user_id": user_id}]
    monkeypatch.setattr(module, "get_request_json", lambda: _Awaitable({"name": "Platform"}))

    created = asyncio.run(module.create_team())
    listed = module.list_teams()

    assert created["data"]["name"] == "Platform"
    assert listed["data"] == [{"tenant_id": "team-1", "user_id": "user-1"}]


def test_team_errors_have_stable_status_codes(monkeypatch):
    module = _load(monkeypatch)
    module.TeamService.get = lambda *_args: (_ for _ in ()).throw(PermissionError("No authorization."))
    module.TeamService.delete = lambda *_args: (_ for _ in ()).throw(LookupError("Team not found."))

    assert module.get_team("team-1")["code"] == 403
    assert module.delete_team("team-1")["code"] == 404
