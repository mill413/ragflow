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

from contextlib import contextmanager

from api.db.services import canvas_service
from api.db.services.canvas_service import UserCanvasService


class _Field:
    def __eq__(self, value):
        return value


class _DeleteQuery:
    def __init__(self, table_name, calls):
        self._table_name = table_name
        self._calls = calls

    def where(self, value):
        self._value = value
        return self

    def execute(self):
        self._calls.append((self._table_name, self._value))
        return 1


def _model(table_name, calls, field_name):
    field = _Field()

    class Model:
        id = field

        @classmethod
        def delete(cls):
            return _DeleteQuery(table_name, calls)

    setattr(Model, field_name, field)
    return Model


def _call_without_connection_context(bound_method, service_class, *args):
    return bound_method.__func__.__wrapped__(service_class, *args)


def test_delete_canvas_dependencies_uses_one_transaction(monkeypatch):
    calls = []

    class _Database:
        @contextmanager
        def atomic(self):
            calls.append(("transaction", "begin"))
            try:
                yield
            finally:
                calls.append(("transaction", "end"))

    monkeypatch.setattr(canvas_service, "DB", _Database())
    monkeypatch.setattr(canvas_service, "API4Conversation", _model("conversation", calls, "dialog_id"))
    monkeypatch.setattr(canvas_service, "UserCanvasVersion", _model("version", calls, "user_canvas_id"))
    monkeypatch.setattr(canvas_service, "APIToken", _model("token", calls, "dialog_id"))
    monkeypatch.setattr(UserCanvasService, "model", _model("canvas", calls, "id"))

    deleted = _call_without_connection_context(
        UserCanvasService.delete_with_dependencies,
        UserCanvasService,
        "agent-1",
    )

    assert deleted == 1
    assert calls == [
        ("transaction", "begin"),
        ("conversation", "agent-1"),
        ("version", "agent-1"),
        ("token", "agent-1"),
        ("canvas", "agent-1"),
        ("transaction", "end"),
    ]
