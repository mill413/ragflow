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

import ast
import re
from pathlib import Path


def _load_prompt_helpers():
    repo_root = Path(__file__).resolve().parents[5]
    source_path = repo_root / "api/apps/restful_apis/chat_api.py"
    tree = ast.parse(source_path.read_text())
    names = {"_prompt_variables", "_strip_prompt_code_fence"}
    functions = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in names
    ]
    module = ast.Module(body=functions, type_ignores=[])
    namespace = {
        "re": re,
        "_PROMPT_VARIABLE_PATTERN": re.compile(
            r"(?<!\{)\{[A-Za-z_][A-Za-z0-9_.-]*\}(?!\})"
        ),
    }
    exec(compile(module, str(source_path), "exec"), namespace)
    return namespace


def test_prompt_variables_collects_only_supported_placeholders():
    helpers = _load_prompt_helpers()

    assert helpers["_prompt_variables"](
        "Use {knowledge}, {user.name}, {language-code}, and ignore {{escaped}}."
    ) == {"{knowledge}", "{user.name}", "{language-code}"}


def test_strip_prompt_code_fence_removes_only_outer_fence():
    helpers = _load_prompt_helpers()

    assert helpers["_strip_prompt_code_fence"]("```text\noptimized\n```") == "optimized"
    assert helpers["_strip_prompt_code_fence"]("Keep ```inline``` content") == "Keep ```inline``` content"
