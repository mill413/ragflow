#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path


DIRECT_WHEELS = {
    "graspologic": "graspologic-*.whl",
    "en-core-web-sm": "en_core_web_sm-*.whl",
}


def find_wheel(wheel_dir: Path, pattern: str) -> Path:
    matches = list(wheel_dir.glob(pattern))
    if len(matches) != 1:
        raise RuntimeError(f"expected exactly one wheel matching {pattern}, found {len(matches)}")
    return matches[0].resolve()


def replace_direct_dependencies(project_text: str, wheel_dir: Path) -> str:
    for package_name, wheel_pattern in DIRECT_WHEELS.items():
        wheel = find_wheel(wheel_dir, wheel_pattern)
        requirement = json.dumps(f"{package_name} @ {wheel.as_uri()}")
        pattern = rf'"{re.escape(package_name)}\s*@\s*(?:git\+)?https?://[^"]+"'
        project_text, count = re.subn(pattern, requirement, project_text, count=1)
        if count != 1:
            raise RuntimeError(f"unable to replace the direct dependency for {package_name}")
    return project_text


def replace_indexes(project_text: str, index_url: str) -> str:
    replacement = f"[[tool.uv.index]]\nurl = {json.dumps(index_url)}\ndefault = true\n\n"
    project_text, count = re.subn(
        r"\[\[tool\.uv\.index\]\].*?(?=\[tool\.setuptools\])",
        replacement,
        project_text,
        count=1,
        flags=re.S,
    )
    if count != 1:
        raise RuntimeError("unable to replace tool.uv.index configuration")
    return project_text


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--project", type=Path, required=True)
    parser.add_argument("--wheel-dir", type=Path, required=True)
    parser.add_argument("--index-url", default="")
    args = parser.parse_args()

    project_text = replace_direct_dependencies(args.project.read_text(), args.wheel_dir)
    if args.index_url:
        project_text = replace_indexes(project_text, args.index_url)
    args.project.write_text(project_text)


if __name__ == "__main__":
    main()
