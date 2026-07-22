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

from common.constants import MAXIMUM_PAGE_NUMBER
from common.token_utils import num_tokens_from_string
from deepdoc.parser.utils import get_text
from rag.nlp import rag_tokenizer, tokenize_chunks


SUPPORTED_EXTENSIONS = {".csv", ".json", ".md", ".mdx", ".txt"}


def _merge_sections(text: str, delimiter: str, max_tokens: int) -> list[str]:
    sections = [section.strip() for section in text.split(delimiter) if section.strip()]
    chunks: list[str] = []
    current: list[str] = []

    for section in sections:
        candidate = delimiter.join([*current, section])
        if current and num_tokens_from_string(candidate) > max_tokens:
            chunks.append(delimiter.join(current))
            current = [section]
        else:
            current.append(section)

    if current:
        chunks.append(delimiter.join(current))
    return chunks


def chunk(filename, binary=None, from_page=0, to_page=MAXIMUM_PAGE_NUMBER, lang="Chinese", callback=None, **kwargs):
    """Split plain-text files by a configurable delimiter and token target.

    This intentionally small implementation exercises the same parser contract as
    the other built-in chunk methods. Page arguments are accepted for interface
    compatibility but are not used for plain-text inputs.
    """
    del from_page, to_page
    extension = re.search(r"(\.[^.]+)$", filename.lower())
    if not extension or extension.group(1) not in SUPPORTED_EXTENSIONS:
        raise NotImplementedError("custom_chunk supports TXT, Markdown, CSV, and JSON files only")

    parser_config = kwargs.get("parser_config") or {}
    delimiter = str(parser_config.get("delimiter") or "\n").replace(r"\n", "\n").replace(r"\t", "\t")
    max_tokens = max(1, int(parser_config.get("chunk_token_num") or 128))
    language = lang or "Chinese"
    callback = callback or (lambda *args, **kwargs: None)

    callback(0.1, "Start custom chunking.")
    content = get_text(filename, binary)
    sections = _merge_sections(content, delimiter, max_tokens)
    title = re.sub(r"\.[a-zA-Z0-9]+$", "", filename)
    document = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize(title),
    }
    document["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(document["title_tks"])
    chunks = tokenize_chunks(sections, document, language.lower() == "english", language=language)
    callback(0.8, f"Custom chunking produced {len(chunks)} chunks.")
    return chunks
