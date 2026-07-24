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

import importlib.util
import sys
from pathlib import Path
from types import ModuleType, SimpleNamespace
from unittest.mock import MagicMock

import pytest

pytestmark = pytest.mark.p2


def _stub(monkeypatch, name, **attrs):
    module = ModuleType(name)
    for key, value in attrs.items():
        setattr(module, key, value)
    monkeypatch.setitem(sys.modules, name, module)
    if "." in name:
        parent_name, _, child_name = name.rpartition(".")
        parent_module = sys.modules.get(parent_name)
        if parent_module is not None:
            monkeypatch.setattr(parent_module, child_name, module, raising=False)
    return module


def _load_service(monkeypatch, parser_id):
    update_by_id = MagicMock(return_value=True)
    get_parser = MagicMock(return_value=parser_id)

    _stub(
        monkeypatch,
        "api.db.services.document_service",
        DocumentService=SimpleNamespace(update_by_id=update_by_id),
    )
    _stub(
        monkeypatch,
        "api.db.services.file2document_service",
        File2DocumentService=SimpleNamespace(),
    )
    _stub(
        monkeypatch,
        "api.db.services.file_service",
        FileService=SimpleNamespace(get_parser=get_parser),
    )
    validation_module = _stub(
        monkeypatch,
        "api.utils.validation_utils",
        UpdateDocumentReq=object,
    )
    _stub(monkeypatch, "api.utils", validation_utils=validation_module)
    _stub(
        monkeypatch,
        "api.utils.api_utils",
        get_error_data_result=lambda **kwargs: kwargs,
        server_error_response=lambda error: {"error": str(error)},
        get_parser_config=lambda *_args, **_kwargs: {},
    )
    _stub(
        monkeypatch,
        "common.constants",
        TaskStatus=SimpleNamespace(RUNNING=SimpleNamespace(value="1")),
    )
    _stub(monkeypatch, "common.settings", docStoreConn=SimpleNamespace())
    search_module = _stub(
        monkeypatch,
        "rag.nlp.search",
        index_name=lambda tenant_id: tenant_id,
    )
    tokenizer_module = _stub(
        monkeypatch,
        "rag.nlp.rag_tokenizer",
        tokenize=lambda text: [text],
        fine_grained_tokenize=lambda tokens: tokens,
    )
    _stub(
        monkeypatch,
        "rag.nlp",
        search=search_module,
        rag_tokenizer=tokenizer_module,
    )

    module_path = Path(__file__).resolve().parents[5] / "api" / "apps" / "services" / "document_api_service.py"
    spec = importlib.util.spec_from_file_location("test_overwrite_document_parser_config_module", module_path)
    module = importlib.util.module_from_spec(spec)
    monkeypatch.setitem(sys.modules, "test_overwrite_document_parser_config_module", module)
    spec.loader.exec_module(module)
    return module, update_by_id, get_parser


def test_overwrite_document_parser_config_uses_current_knowledgebase_settings(monkeypatch):
    module, update_by_id, get_parser = _load_service(monkeypatch, parser_id="paper")
    doc = SimpleNamespace(
        id="doc-1",
        type="pdf",
        name="manual.pdf",
        parser_id="naive",
        parser_config={"chunk_token_num": 128},
        pipeline_id=None,
    )
    kb = SimpleNamespace(
        parser_id="paper",
        parser_config={"chunk_token_num": 512, "nested": {"enabled": True}},
        pipeline_id="pipeline-1",
    )

    module.overwrite_document_parser_config_from_knowledgebase(doc, kb)

    get_parser.assert_called_once_with("pdf", "manual.pdf", "paper")
    update_by_id.assert_called_once_with(
        "doc-1",
        {
            "parser_id": "paper",
            "parser_config": {
                "chunk_token_num": 512,
                "nested": {"enabled": True},
            },
            "pipeline_id": "pipeline-1",
        },
    )
    assert doc.parser_id == "paper"
    assert doc.pipeline_id == "pipeline-1"
    assert doc.parser_config == kb.parser_config
    assert doc.parser_config is not kb.parser_config
    assert doc.parser_config["nested"] is not kb.parser_config["nested"]


def test_overwrite_document_parser_config_preserves_file_type_parser(monkeypatch):
    module, update_by_id, _ = _load_service(monkeypatch, parser_id="picture")
    doc = SimpleNamespace(
        id="doc-image",
        type="visual",
        name="diagram.png",
        parser_id="picture",
        parser_config={},
        pipeline_id=None,
    )
    kb = SimpleNamespace(
        parser_id="paper",
        parser_config={"chunk_token_num": 512},
        pipeline_id=None,
    )

    module.overwrite_document_parser_config_from_knowledgebase(doc, kb)

    assert update_by_id.call_args.args[1]["parser_id"] == "picture"
    assert doc.parser_id == "picture"
