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

import shutil
import subprocess
import tempfile
from pathlib import Path


class RAGFlowWpsParser:
    """Extract text from legacy binary .wps documents."""

    def __init__(self, timeout: int = 120):
        self.timeout = timeout

    def _parse_with_libwps(self, input_path: Path) -> str:
        executable = shutil.which("wps2text")
        if not executable:
            raise RuntimeError("wps2text is not installed")

        completed = subprocess.run(
            [executable, str(input_path)],
            check=False,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=self.timeout,
        )
        text = completed.stdout.decode("utf-8", errors="replace").strip()
        if completed.returncode != 0 or not text:
            error = completed.stderr.decode("utf-8", errors="replace").strip()
            raise RuntimeError(error or "wps2text returned no content")
        return text

    def _parse_with_tika(self, input_path: Path) -> str:
        from tika import parser as tika_parser

        parsed = tika_parser.from_file(
            str(input_path),
            requestOptions={"timeout": self.timeout},
        )
        text = (parsed or {}).get("content")
        if not text or not text.strip():
            raise RuntimeError("Tika returned no content")
        return text.strip()

    def __call__(self, filename: str, binary: bytes) -> str:
        if not binary:
            raise ValueError(f"Empty WPS document: {filename}")

        errors = []
        with tempfile.TemporaryDirectory(prefix="ragflow-wps-") as temp_dir:
            input_path = Path(temp_dir) / "document.wps"
            input_path.write_bytes(binary)

            for parser_name, parse in (
                ("libwps", self._parse_with_libwps),
                ("Tika", self._parse_with_tika),
            ):
                try:
                    return parse(input_path)
                except subprocess.TimeoutExpired:
                    errors.append(f"{parser_name} timed out after {self.timeout}s")
                except Exception as exc:
                    errors.append(f"{parser_name}: {exc}")

        raise RuntimeError(
            f"Unable to parse WPS document {filename}. " + "; ".join(errors)
        )
