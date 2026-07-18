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

import asyncio
import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace

import pytest


class _DummyManager:
    def route(self, *_args, **_kwargs):
        def decorator(func):
            return func

        return decorator


class _AwaitableValue:
    def __init__(self, value):
        self._value = value

    def __await__(self):
        async def _co():
            return self._value

        return _co().__await__()


class _Args(dict):
    def get(self, key, default=None, type=None):
        value = super().get(key, default)
        if type is None:
            return value
        try:
            return type(value)
        except (TypeError, ValueError):
            return default

    def to_dict(self, flat=True):
        return dict(self)


class _FakeConnectorRecord:
    def __init__(self, payload):
        self._payload = payload

    def to_dict(self):
        return dict(self._payload)

    def __getattr__(self, name):
        return self._payload[name]


def _run(coro):
    return asyncio.run(coro)


def _set_request(module, *, args=None, json_body=None):
    module.request = SimpleNamespace(
        args=_Args(args or {}),
        json=_AwaitableValue({} if json_body is None else json_body),
    )


@pytest.fixture(scope="session")
def auth():
    return "unit-auth"


@pytest.fixture(scope="session", autouse=True)
def set_tenant_info():
    return None


def _load_connector_app(monkeypatch):
    repo_root = Path(__file__).resolve().parents[3]

    api_pkg = ModuleType("api")
    api_pkg.__path__ = [str(repo_root / "api")]
    monkeypatch.setitem(sys.modules, "api", api_pkg)

    apps_mod = ModuleType("api.apps")
    apps_mod.__path__ = [str(repo_root / "api" / "apps")]
    apps_mod.current_user = SimpleNamespace(id="tenant-1")
    apps_mod.login_required = lambda fn: fn
    monkeypatch.setitem(sys.modules, "api.apps", apps_mod)

    workspace_access_mod = ModuleType("api.apps.workspace_access")
    workspace_access_mod.personal_workspace_required = lambda fn: fn
    monkeypatch.setitem(sys.modules, "api.apps.workspace_access", workspace_access_mod)

    db_mod = ModuleType("api.db")
    db_mod.InputType = SimpleNamespace(POLL="POLL")
    monkeypatch.setitem(sys.modules, "api.db", db_mod)

    services_pkg = ModuleType("api.db.services")
    services_pkg.__path__ = []
    monkeypatch.setitem(sys.modules, "api.db.services", services_pkg)

    connector_service_mod = ModuleType("api.db.services.connector_service")

    class _StubConnectorService:
        @staticmethod
        def update_by_id(*_args, **_kwargs):
            return True

        @staticmethod
        def save(**_kwargs):
            return True

        @staticmethod
        def get_by_id(_connector_id):
            return True, _FakeConnectorRecord({"id": _connector_id})

        @staticmethod
        def list(_tenant_id):
            return []

        @staticmethod
        def accessible(*_args, **_kwargs):
            return True

        @staticmethod
        def cancel_tasks(*_args, **_kwargs):
            return True

        @staticmethod
        def rebuild(*_args, **_kwargs):
            return None

        @staticmethod
        def delete_by_id(*_args, **_kwargs):
            return True

    class _StubSyncLogsService:
        @staticmethod
        def list_sync_tasks(*_args, **_kwargs):
            return [], 0

    connector_service_mod.ConnectorService = _StubConnectorService
    connector_service_mod.SyncLogsService = _StubSyncLogsService
    monkeypatch.setitem(sys.modules, "api.db.services.connector_service", connector_service_mod)

    api_utils_mod = ModuleType("api.utils.api_utils")

    async def _get_request_json():
        return {}

    api_utils_mod.get_request_json = _get_request_json
    api_utils_mod.get_json_result = lambda data=None, message="", code=0: {
        "code": code,
        "message": message,
        "data": data,
    }
    api_utils_mod.get_data_error_result = lambda message="", code=400, data=None: {
        "code": code,
        "message": message,
        "data": data,
    }
    api_utils_mod.validate_request = lambda *_args, **_kwargs: lambda fn: fn
    monkeypatch.setitem(sys.modules, "api.utils.api_utils", api_utils_mod)

    constants_mod = ModuleType("common.constants")
    constants_mod.RetCode = SimpleNamespace(
        ARGUMENT_ERROR=101,
        SERVER_ERROR=500,
        RUNNING=102,
        PERMISSION_ERROR=403,
        AUTHENTICATION_ERROR=109,
    )
    constants_mod.TaskStatus = SimpleNamespace(
        UNSTART="unstart",
        SCHEDULE="schedule",
        CANCEL="cancel",
    )
    constants_mod.SUPPORTED_DATA_SOURCES = frozenset({"s3", "imap", "mysql", "postgresql"})
    monkeypatch.setitem(sys.modules, "common.constants", constants_mod)

    config_mod = ModuleType("common.data_source.config")
    monkeypatch.setitem(sys.modules, "common.data_source.config", config_mod)

    misc_mod = ModuleType("common.misc_utils")
    misc_mod.get_uuid = lambda: "uuid-from-helper"
    monkeypatch.setitem(sys.modules, "common.misc_utils", misc_mod)

    quart_mod = ModuleType("quart")
    quart_mod.request = SimpleNamespace(args=_Args(), json=_AwaitableValue({}))
    monkeypatch.setitem(sys.modules, "quart", quart_mod)

    module_path = repo_root / "api" / "apps" / "restful_apis" / "connector_api.py"
    spec = importlib.util.spec_from_file_location("test_connector_routes_unit", module_path)
    module = importlib.util.module_from_spec(spec)
    module.manager = _DummyManager()
    spec.loader.exec_module(module)
    return module


@pytest.mark.p2
def test_connector_basic_routes_and_task_controls(monkeypatch):
    module = _load_connector_app(monkeypatch)

    async def _no_sleep(_secs):
        return None

    monkeypatch.setattr(module.asyncio, "sleep", _no_sleep)

    records = {"conn-1": _FakeConnectorRecord({"id": "conn-1", "source": "s3"})}
    update_calls = []
    save_calls = []
    cancel_calls = []
    delete_calls = []

    monkeypatch.setattr(module.ConnectorService, "update_by_id", lambda cid, payload: update_calls.append((cid, payload)))

    def _save(**payload):
        save_calls.append(payload)
        records[payload["id"]] = _FakeConnectorRecord(payload)

    monkeypatch.setattr(module.ConnectorService, "save", _save)
    monkeypatch.setattr(module.ConnectorService, "get_by_id", lambda cid: (True, records[cid]))
    monkeypatch.setattr(module.ConnectorService, "list", lambda tenant_id: [{"id": "listed", "tenant": tenant_id, "source": "s3"}])
    monkeypatch.setattr(module.SyncLogsService, "list_sync_tasks", lambda cid, page, page_size: ([{"id": "log-1"}], 9))
    monkeypatch.setattr(module.ConnectorService, "cancel_tasks", lambda cid: cancel_calls.append(cid))
    monkeypatch.setattr(module.ConnectorService, "delete_by_id", lambda cid: delete_calls.append(cid))
    monkeypatch.setattr(module, "get_uuid", lambda: "generated-id")

    monkeypatch.setattr(
        module,
        "get_request_json",
        lambda: _AwaitableValue({"id": "conn-1", "refresh_freq": 7, "config": {"x": 1}}),
    )
    res = _run(module.update_connector("conn-1"))
    assert update_calls == [("conn-1", {"id": "conn-1", "refresh_freq": 7, "config": {"x": 1}})]
    assert res["data"]["id"] == "conn-1"

    monkeypatch.setattr(
        module,
        "get_request_json",
        lambda: _AwaitableValue({"name": "new", "source": "s3", "config": {"y": 2}}),
    )
    res = _run(module.create_connector())
    assert save_calls[-1]["id"] == "generated-id"
    assert save_calls[-1]["tenant_id"] == "tenant-1"
    assert save_calls[-1]["input_type"] == module.InputType.POLL
    assert save_calls[-1]["status"] == module.TaskStatus.UNSTART
    assert res["data"]["id"] == "generated-id"

    monkeypatch.setattr(
        module,
        "get_request_json",
        lambda: _AwaitableValue({"name": "unsupported", "source": "google_drive", "config": {}}),
    )
    unsupported = _run(module.create_connector())
    assert unsupported["code"] == module.RetCode.ARGUMENT_ERROR
    assert len(save_calls) == 1

    list_res = module.list_connector()
    assert list_res["data"] == [{"id": "listed", "tenant": "tenant-1", "source": "s3"}]

    monkeypatch.setattr(module.ConnectorService, "get_by_id", lambda _cid: (False, None))
    missing_res = module.get_connector("missing")
    assert missing_res["message"] == "Can't find this Connector!"

    monkeypatch.setattr(module.ConnectorService, "get_by_id", lambda cid: (True, _FakeConnectorRecord({"id": cid, "source": "s3"})))
    found_res = module.get_connector("conn-2")
    assert found_res["data"]["id"] == "conn-2"

    _set_request(module, args={"page": "2", "page_size": "7"})
    logs_res = module.list_logs("conn-log")
    assert logs_res["data"] == {"total": 9, "logs": [{"id": "log-1"}]}

    monkeypatch.setattr(module, "get_request_json", lambda: _AwaitableValue({"kb_id": "kb-1"}))
    monkeypatch.setattr(module.ConnectorService, "rebuild", lambda *_args: "rebuild-failed")
    failed_rebuild = _run(module.rebuild("conn-rb"))
    assert failed_rebuild["code"] == module.RetCode.SERVER_ERROR
    assert failed_rebuild["data"] is False

    monkeypatch.setattr(module.ConnectorService, "rebuild", lambda *_args: None)
    ok_rebuild = _run(module.rebuild("conn-rb"))
    assert ok_rebuild["data"] is True

    rm_res = module.rm_connector("conn-rm")
    assert rm_res["data"] is True
    assert cancel_calls == ["conn-rm"]
    assert delete_calls == ["conn-rm"]


@pytest.mark.p2
def test_connector_by_id_routes_reject_cross_tenant_access(monkeypatch):
    """Verify per-id connector routes stop before body parsing or service access."""
    module = _load_connector_app(monkeypatch)

    touched = []
    monkeypatch.setattr(module.ConnectorService, "accessible", lambda cid, uid: False)
    monkeypatch.setattr(module.ConnectorService, "get_by_id", lambda *_args: touched.append("get_by_id"))
    monkeypatch.setattr(module.SyncLogsService, "list_sync_tasks", lambda *_args: touched.append("list_sync_tasks"))
    monkeypatch.setattr(module.ConnectorService, "cancel_tasks", lambda *_args: touched.append("cancel_tasks"))
    monkeypatch.setattr(module.ConnectorService, "delete_by_id", lambda *_args: touched.append("delete_by_id"))
    monkeypatch.setattr(module.ConnectorService, "update_by_id", lambda *_args: touched.append("update_by_id"))
    monkeypatch.setattr(module.ConnectorService, "rebuild", lambda *_args: touched.append("rebuild"))

    def _get_request_json():
        touched.append("get_request_json")
        return _AwaitableValue({"config": {"x": 1}})

    monkeypatch.setattr(module, "get_request_json", _get_request_json)

    responses = [
        _run(module.update_connector("conn-victim")),
        module.get_connector("conn-victim"),
        module.list_logs("conn-victim"),
        _run(module.rebuild("conn-victim")),
        module.rm_connector("conn-victim"),
    ]

    assert all(res["code"] == module.RetCode.AUTHENTICATION_ERROR for res in responses)
    assert all(res["message"] == "No authorization." for res in responses)
    assert all(res["data"] is False for res in responses)
    assert touched == []
