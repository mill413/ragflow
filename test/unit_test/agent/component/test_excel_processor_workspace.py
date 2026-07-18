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

from types import SimpleNamespace

import pytest

from agent.component import excel_processor as excel_module


class _FakeCanvas:
    def __init__(self, value):
        self.value = value

    def get_tenant_id(self):
        return "team-1"

    def get_variable_value(self, _reference):
        return self.value


def _component(value):
    component = excel_module.ExcelProcessor.__new__(excel_module.ExcelProcessor)
    component._canvas = _FakeCanvas(value)
    return component


def test_excel_rejects_managed_file_from_another_workspace(monkeypatch):
    component = _component({"id": "file-1", "name": "secret.xlsx", "created_by": "team-1"})
    monkeypatch.setattr(
        excel_module.FileService,
        "get_by_id",
        lambda _file_id: (
            True,
            SimpleNamespace(
                id="file-1",
                tenant_id="team-2",
                parent_id="folder-2",
                location="secret.xlsx",
                name="secret.xlsx",
            ),
        ),
    )

    with pytest.raises(PermissionError, match="same workspace"):
        component._get_file_content("{Begin@file}")


def test_excel_rejects_uploaded_file_from_another_workspace(monkeypatch):
    component = _component({"id": "upload-1", "name": "secret.xlsx", "created_by": "user-2"})
    monkeypatch.setattr(excel_module.FileService, "get_by_id", lambda _file_id: (False, None))

    with pytest.raises(PermissionError, match="same workspace"):
        component._get_file_content("{Begin@file}")


def test_excel_reads_managed_file_from_its_workspace(monkeypatch):
    component = _component({"id": "file-1", "name": "report.xlsx", "created_by": "user-2"})
    stored_file = SimpleNamespace(
        id="file-1",
        tenant_id="team-1",
        parent_id="folder-1",
        location="stored-report.xlsx",
        name="report.xlsx",
    )
    monkeypatch.setattr(excel_module.FileService, "get_by_id", lambda _file_id: (True, stored_file))
    monkeypatch.setattr(
        excel_module.settings,
        "STORAGE_IMPL",
        SimpleNamespace(get=lambda parent_id, location: b"xlsx" if (parent_id, location) == ("folder-1", "stored-report.xlsx") else None),
    )

    content, filename = component._get_file_content("{Begin@file}")

    assert content == b"xlsx"
    assert filename == "report.xlsx"
