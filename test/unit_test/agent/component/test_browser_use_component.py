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

import re
import sys
import types
from pathlib import Path
from types import SimpleNamespace
from urllib.parse import urlparse

import pytest

from api.db import FileType


def _install_cv2_stub_if_unavailable():
    try:
        import cv2  # noqa: F401

        return
    except Exception:
        pass
    stub = types.ModuleType("cv2")
    stub.INTER_LINEAR = 1
    stub.INTER_CUBIC = 2
    stub.BORDER_CONSTANT = 0
    stub.BORDER_REPLICATE = 1

    def _module_getattr(name):
        if name.isupper():
            return 0
        raise RuntimeError("cv2 runtime call is unavailable in this test environment")

    stub.__getattr__ = _module_getattr
    sys.modules["cv2"] = stub


_install_cv2_stub_if_unavailable()

# Importing agent.component discovers every tool module. scholarly 1.7.11 is
# not Python 3.13-clean, and Browser tests do not exercise Google Scholar.
scholarly_stub = types.ModuleType("scholarly")
scholarly_stub.scholarly = SimpleNamespace()
sys.modules["scholarly"] = scholarly_stub

from agent.component import browser as browser_use_module  # noqa: E402


class _FakeCanvas:
    def __init__(self, refs=None):
        self._refs = refs or {}

    def is_reff(self, token):
        key = token.strip("{} ")
        return key in self._refs or token in self._refs

    def get_variable_value(self, token):
        key = token.strip("{} ")
        if key in self._refs:
            return self._refs[key]
        return self._refs[token]

    def get_tenant_id(self):
        return "tenant-1"


def _build_component():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas()
    component._param = SimpleNamespace(upload_sources="")
    return component


def test_prepare_input_values_records_variable_inputs():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas(refs={"sys.query": "open example.com"})
    component._param = browser_use_module.BrowserParam()
    component._param.prompts = "{sys.query}"
    component._param.inputs = {}

    component._prepare_input_values()

    assert component.get_input_value("sys.query") == "open example.com"
    assert component.get_input_values()["sys.query"] == "open example.com"


def test_extract_ids_supports_mixed_literals_and_variables():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas(
        refs={
            "{begin@file_ids}": ["f2", "f3,f4"],
            "{begin@extra_file}": "f5",
        }
    )

    file_ids = component._extract_ids("f1,{begin@file_ids},{begin@extra_file},f1")

    assert file_ids == ["f1", "f2", "f3", "f4", "f5"]


def test_extract_ids_supports_json_array_and_csv_format():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas()

    json_ids = component._extract_ids('["1","2"]')
    csv_ids = component._extract_ids("1,2")

    assert json_ids == ["1", "2"]
    assert csv_ids == ["1", "2"]


def test_extract_ids_supports_variable_values_from_input_or_globals():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas(
        refs={
            "{begin@upload_ids}": '["10","20"]',
            "{sys@upload_id}": 30,
            "{begin@file_obj}": {"id": "40", "name": "demo.pdf"},
        }
    )

    file_ids = component._extract_ids("{begin@upload_ids},{sys@upload_id},{begin@file_obj}")

    assert file_ids == ["10", "20", "30", "40"]


def test_extract_ids_supports_url_key_in_variable_object():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas(
        refs={
            "{begin@upload_url_obj}": {"url": "https://example.com/demo.pdf"},
        }
    )

    refs = component._extract_ids("{begin@upload_url_obj}")

    assert refs == ["https://example.com/demo.pdf"]


def test_extract_ids_does_not_split_http_url_by_comma():
    component = browser_use_module.Browser.__new__(browser_use_module.Browser)
    component._canvas = _FakeCanvas()

    refs = component._extract_ids("https://example.com/download?name=a,b.txt")

    assert refs == ["https://example.com/download?name=a,b.txt"]


class _FakeRequestsResponse:
    def __init__(self, status_code=200, headers=None, data=b""):
        self.status_code = status_code
        self.headers = dict(headers or {})
        self._data = data
        self.closed = False

    def iter_content(self, chunk_size=1024 * 1024):
        for i in range(0, len(self._data), max(chunk_size, 1)):
            yield self._data[i : i + chunk_size]

    def raise_for_status(self):
        if self.status_code >= 400:
            raise AssertionError(f"unexpected HTTP status: {self.status_code}")

    def close(self):
        self.closed = True


class _FakeRequestsSession:
    def __init__(self, handler):
        self.trust_env = True
        self.closed = False
        self.calls = []
        self._handler = handler

    def get(self, url, **kwargs):
        self.calls.append(url)
        return self._handler(url, **kwargs)

    def close(self):
        self.closed = True


def _patch_requests_session(monkeypatch, handler):
    import requests

    created = []

    def _factory():
        session = _FakeRequestsSession(handler)
        created.append(session)
        return session

    monkeypatch.setattr(requests, "Session", _factory)
    return created


def _allow_public_hosts(monkeypatch):
    import common.ssrf_guard as ssrf

    def _fake_assert(url):
        host = urlparse(url).hostname or ""
        if host in {"example.com", "cdn.example.net"}:
            return host, "93.184.216.34"
        raise ValueError(f"blocked in test: {url}")

    monkeypatch.setattr(ssrf, "assert_url_is_safe", _fake_assert)


def test_prepare_upload_files_supports_http_url(monkeypatch, tmp_path):
    component = _build_component()
    component._param.upload_sources = "https://example.com/files/demo.txt"
    _allow_public_hosts(monkeypatch)
    sessions = _patch_requests_session(
        monkeypatch,
        lambda _url, **_kwargs: _FakeRequestsResponse(
            headers={"Content-Disposition": 'attachment; filename="remote_demo.txt"'},
            data=b"hello from url",
        ),
    )

    prepared = component._prepare_upload_files(str(tmp_path))

    assert len(prepared) == 1
    assert prepared[0]["name"] == "remote_demo.txt"
    assert Path(prepared[0]["local_path"]).read_bytes() == b"hello from url"
    assert sessions[0].trust_env is False
    assert sessions[0].closed is True


def test_extract_url_filename_sanitizes_encoded_traversal():
    name = browser_use_module.Browser._extract_url_filename(
        "https://example.com/%2e%2e%2f..%2fetc%2fpasswd",
        {"Content-Disposition": "attachment; filename*=UTF-8''..%2f..%2fowned.txt"},
    )

    assert name == "owned.txt"
    assert re.fullmatch(
        r"url_file_[0-9a-f]{8}\.bin",
        browser_use_module.Browser._extract_url_filename("https://example.com/%2e%2e%2f", {}),
    )


def test_prepare_upload_url_rejects_private_addresses(monkeypatch, tmp_path):
    component = _build_component()
    calls = []
    sessions = _patch_requests_session(monkeypatch, lambda url, **_kwargs: calls.append(url))

    for url in ("http://127.0.0.1/admin", "http://169.254.169.254/latest/meta-data/", "http://10.1.2.3/internal"):
        assert component._prepare_upload_url_file(url, str(tmp_path)) is None

    assert calls == []
    assert all(session.closed for session in sessions)


def test_prepare_upload_url_revalidates_redirects(monkeypatch, tmp_path):
    component = _build_component()
    _allow_public_hosts(monkeypatch)
    calls = []

    def _redirect(url, **_kwargs):
        calls.append(url)
        return _FakeRequestsResponse(status_code=302, headers={"Location": "http://169.254.169.254/latest/meta-data/"})

    _patch_requests_session(monkeypatch, _redirect)

    assert component._prepare_upload_url_file("https://example.com/file.bin", str(tmp_path)) is None
    assert calls == ["https://example.com/file.bin"]


def test_prepare_upload_files_rejects_file_from_another_workspace(monkeypatch, tmp_path):
    component = _build_component()
    component._param.upload_sources = "file-1"
    monkeypatch.setattr(
        browser_use_module.FileService,
        "get_by_id",
        lambda _file_id: (
            True,
            SimpleNamespace(
                id="file-1",
                tenant_id="tenant-2",
                parent_id="folder-2",
                location="secret.xlsx",
                name="secret.xlsx",
                size=10,
            ),
        ),
    )

    with pytest.raises(PermissionError, match="same workspace"):
        component._prepare_upload_files(str(tmp_path))


def test_save_downloads_persists_file_records(monkeypatch, tmp_path):
    component = _build_component()
    component._canvas = _FakeCanvas()

    download_file = tmp_path / "report.txt"
    download_file.write_text("ok", encoding="utf-8")

    monkeypatch.setattr(
        browser_use_module.FileService,
        "get_by_id",
        lambda _folder_id: (
            True,
            SimpleNamespace(type=FileType.FOLDER.value, tenant_id="tenant-1"),
        ),
    )
    monkeypatch.setattr(browser_use_module, "duplicate_name", lambda *_args, **_kwargs: "report.txt")

    stored = {}

    def _put(parent_id, location, blob):
        stored["parent_id"] = parent_id
        stored["location"] = location
        stored["blob"] = blob

    monkeypatch.setattr(browser_use_module.settings, "STORAGE_IMPL", SimpleNamespace(put=_put))
    monkeypatch.setattr(
        browser_use_module.FileService,
        "insert",
        lambda data: SimpleNamespace(
            id="file-1",
            name=data["name"],
            size=data["size"],
            parent_id=data["parent_id"],
        ),
    )

    result = component._save_downloads(str(tmp_path), "dir-1")

    assert len(result) == 1
    assert result[0]["file_id"] == "file-1"
    assert result[0]["parent_id"] == "dir-1"
    assert stored["parent_id"] == "dir-1"
    assert stored["location"] == "report.txt"
    assert stored["blob"] == b"ok"
    assert Path(download_file).exists()
