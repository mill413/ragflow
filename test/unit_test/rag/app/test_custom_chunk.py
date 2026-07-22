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

from unittest.mock import patch

import pytest

from rag.app import custom_chunk


def test_merge_sections_respects_delimiter_and_token_target():
    with patch.object(custom_chunk, "num_tokens_from_string", side_effect=len):
        chunks = custom_chunk._merge_sections("alpha\nbeta\ngamma", "\n", 10)

    assert chunks == ["alpha\nbeta", "gamma"]


def test_chunk_uses_existing_parser_result_contract():
    progress = []

    def fake_tokenize_chunks(sections, document, _is_english, **_kwargs):
        return [{**document, "content_with_weight": section} for section in sections]

    with (
        patch.object(custom_chunk, "num_tokens_from_string", side_effect=len),
        patch.object(custom_chunk, "tokenize_chunks", side_effect=fake_tokenize_chunks),
        patch.object(custom_chunk.rag_tokenizer, "tokenize", side_effect=lambda text: text),
        patch.object(custom_chunk.rag_tokenizer, "fine_grained_tokenize", side_effect=lambda text: text),
    ):
        chunks = custom_chunk.chunk(
            "demo.txt",
            binary=b"alpha\nbeta\ngamma",
            parser_config={"delimiter": r"\n", "chunk_token_num": 10},
            callback=lambda percent, message: progress.append((percent, message)),
        )

    assert [chunk["content_with_weight"] for chunk in chunks] == ["alpha\nbeta", "gamma"]
    assert all(chunk["docnm_kwd"] == "demo.txt" for chunk in chunks)
    assert progress[-1] == (0.8, "Custom chunking produced 2 chunks.")


def test_chunk_rejects_unsupported_files():
    with pytest.raises(NotImplementedError):
        custom_chunk.chunk("demo.pdf", binary=b"not a pdf")
