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

from api.db.joint_services.tenant_model_service import get_model_type_by_id, resolve_model_config
from common.constants import LLMType, MAXIMUM_PAGE_NUMBER
from common.parser_config_utils import normalize_layout_recognizer
from rag.app import naive
from rag.nlp import rag_tokenizer, tokenize_chunks, tokenize_table


def _parse_pdf(
    filename,
    binary=None,
    from_page=0,
    to_page=MAXIMUM_PAGE_NUMBER,
    lang="Chinese",
    callback=None,
    layout_recognizer="DeepDOC",
    **kwargs,
):
    """Select and invoke an existing PDF parser for this example method."""
    layout_recognizer, parser_model_name = normalize_layout_recognizer(layout_recognizer)
    opendataloader_llm_name = kwargs.pop("opendataloader_llm_name", None)
    if layout_recognizer == "OpenDataLoader" and parser_model_name:
        opendataloader_llm_name = parser_model_name

    if isinstance(layout_recognizer, bool):
        layout_recognizer = "DeepDOC" if layout_recognizer else "Plain Text"

    parser_name = layout_recognizer.strip().lower()
    if parser_name in {"plain text", "plaintext"}:
        parser_name = "plaintext"
        layout_recognizer = "Plain Text"
    parser = naive.PARSERS.get(parser_name)
    if parser is None and parser_model_name is None:
        try:
            model_types = get_model_type_by_id(layout_recognizer)
        except LookupError:
            pass
        else:
            if LLMType.OCR.value in model_types:
                model_config = resolve_model_config(kwargs.get("tenant_id"), LLMType.OCR, layout_recognizer)
                parser_name = model_config["llm_factory"].strip().lower()
                parser_model_name = layout_recognizer
                parser = naive.PARSERS.get(parser_name)

    parser = parser or naive.by_plaintext
    return parser(
        filename=filename,
        binary=binary,
        from_page=from_page,
        to_page=to_page,
        lang=lang,
        callback=callback,
        layout_recognizer=layout_recognizer,
        mineru_llm_name=parser_model_name,
        paddleocr_llm_name=parser_model_name,
        opendataloader_llm_name=opendataloader_llm_name,
        somark_llm_name=parser_model_name,
        **kwargs,
    )


def chunk(filename, binary=None, from_page=0, to_page=MAXIMUM_PAGE_NUMBER, lang="Chinese", callback=None, **kwargs):
    """Minimal PDF example of RAGFlow's built-in chunk-function contract.

    Args:
        filename: Original PDF file name.
        binary: Optional PDF bytes. When omitted, ``filename`` is read from disk.
        from_page: First page passed to the configured PDF parser.
        to_page: Last page passed to the configured PDF parser.
        lang: Document language passed to the existing tokenizer.
        callback: Optional ``callback(progress, message)`` progress reporter.
        **kwargs: Includes ``parser_config.layout_recognize`` and ``tenant_id``.

    Returns:
        A list of standard chunk dictionaries. Each dictionary contains the
        fields required by indexing, including
        ``content_with_weight``, ``content_ltks`` and ``content_sm_ltks``.

    The configured PDF backend is selected by ``_parse_pdf``. Extension authors
    only transform the returned sections; they do not implement MinerU,
    DeepDOC, or another PDF parser.
    """
    if not re.search(r"\.pdf$", filename, re.IGNORECASE):
        raise NotImplementedError("example_chunk supports PDF files only")

    parser_config = kwargs.get("parser_config") or {}
    language = lang or "Chinese"
    callback = callback or (lambda *args, **kwargs: None)

    callback(0.1, "Start PDF parsing for example chunking.")
    sections, tables, _pdf_parser = _parse_pdf(
        filename,
        binary=binary,
        from_page=from_page,
        to_page=to_page,
        lang=language,
        callback=callback,
        layout_recognizer=parser_config.get("layout_recognize", "DeepDOC"),
        **{key: value for key, value in kwargs.items() if key != "parser_config"},
    )
    if not sections and not tables:
        return []

    section_texts = []
    for section in sections or []:
        text = section[0] if isinstance(section, (tuple, list)) else section
        if text and str(text).strip():
            section_texts.append(str(text).strip())

    title = re.sub(r"\.[a-zA-Z0-9]+$", "", filename)
    document = {
        "docnm_kwd": filename,
        "title_tks": rag_tokenizer.tokenize(title),
    }
    document["title_sm_tks"] = rag_tokenizer.fine_grained_tokenize(document["title_tks"])
    is_english = language.lower() == "english"
    chunks = tokenize_table(tables or [], document, is_english, language=language)
    chunks.extend(tokenize_chunks(section_texts, document, is_english, language=language))
    callback(0.8, f"Example chunking produced {len(chunks)} chunks.")
    return chunks
