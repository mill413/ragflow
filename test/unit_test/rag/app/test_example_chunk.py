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

from unittest.mock import MagicMock, patch

import pytest

from common.constants import LLMType
from rag.app import example_chunk


def test_parse_pdf_resolves_an_ocr_model_id_to_an_existing_parser():
    parser = MagicMock(return_value=([("parsed", "")], [], None))

    with (
        patch.object(example_chunk, "get_model_type_by_id", return_value=[LLMType.OCR.value]),
        patch.object(example_chunk, "resolve_model_config", return_value={"llm_factory": "MinerU"}),
        patch.dict(example_chunk.naive.PARSERS, {"mineru": parser}),
    ):
        sections, tables, pdf_parser = example_chunk._parse_pdf(
            "demo.pdf",
            binary=b"%PDF example",
            layout_recognizer="ocr-model-id",
            tenant_id="workspace-1",
        )

    assert sections == [("parsed", "")]
    assert tables == []
    assert pdf_parser is None
    assert parser.call_args.kwargs["mineru_llm_name"] == "ocr-model-id"
    assert parser.call_args.kwargs["tenant_id"] == "workspace-1"


def test_chunk_reuses_configured_pdf_parser_and_returns_standard_chunks():
    progress = []
    pdf_parser = MagicMock()

    def fake_tokenize_chunks(sections, document, _is_english, **_kwargs):
        return [
            {
                **document,
                "content_with_weight": section,
                "content_ltks": section,
                "content_sm_ltks": section,
            }
            for section in sections
        ]

    with (
        patch.object(
            example_chunk,
            "_parse_pdf",
            return_value=(
                [("first PDF section", "@@1\t0\t0\t0\t0##"), ("second PDF section", "")],
                [],
                pdf_parser,
            ),
        ) as parse_pdf,
        patch.object(example_chunk, "tokenize_table", return_value=[]),
        patch.object(example_chunk, "tokenize_chunks", side_effect=fake_tokenize_chunks),
        patch.object(example_chunk.rag_tokenizer, "tokenize", side_effect=lambda text: text),
        patch.object(example_chunk.rag_tokenizer, "fine_grained_tokenize", side_effect=lambda text: text),
    ):
        chunks = example_chunk.chunk(
            "demo.pdf",
            binary=b"%PDF example",
            parser_config={"layout_recognize": "MinerU/example-model"},
            tenant_id="workspace-1",
            callback=lambda percent, message: progress.append((percent, message)),
        )

    assert [chunk["content_with_weight"] for chunk in chunks] == [
        "first PDF section",
        "second PDF section",
    ]
    assert all(chunk["docnm_kwd"] == "demo.pdf" for chunk in chunks)
    assert all(chunk["content_ltks"] for chunk in chunks)
    assert all(chunk["content_sm_ltks"] for chunk in chunks)
    assert parse_pdf.call_args.kwargs["layout_recognizer"] == "MinerU/example-model"
    assert parse_pdf.call_args.kwargs["tenant_id"] == "workspace-1"
    assert progress[-1] == (0.8, "Example chunking produced 2 chunks.")


def test_chunk_rejects_unsupported_files():
    with pytest.raises(NotImplementedError):
        example_chunk.chunk("demo.txt", binary=b"not a pdf")
