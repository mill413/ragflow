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

from rag.app import naive


def test_by_mineru_preserves_the_actual_api_error():
    parser = MagicMock()
    parser.parse_pdf.side_effect = RuntimeError(
        "MinerU server not accessible: [MinerU] MinerU API not accessible: https://mineru.example/openapi.json: HTTP 504 Gateway Timeout"
    )

    class FakeLLMBundle:
        def __init__(self, *args, **kwargs):
            self.mdl = parser

    with (
        patch.object(naive, "resolve_model_config", return_value={"llm_factory": "MinerU"}),
        patch.object(naive, "LLMBundle", FakeLLMBundle),
        patch.object(naive, "get_tenant_default_model_by_type", side_effect=LookupError("No vision model")),
        pytest.raises(RuntimeError, match="HTTP 504 Gateway Timeout"),
    ):
        naive.by_mineru(
            "demo.pdf",
            binary=b"%PDF example",
            mineru_llm_name="mineru-model",
            tenant_id="workspace-1",
        )


def test_by_mineru_distinguishes_missing_configuration_from_api_failure():
    with (
        patch.object(naive, "get_first_provider_model_name", return_value=None),
        patch.object(naive, "ensure_mineru_from_env", return_value=None),
        pytest.raises(RuntimeError, match="MinerU model not configured"),
    ):
        naive.by_mineru(
            "demo.pdf",
            binary=b"%PDF example",
            tenant_id="workspace-1",
        )
