import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[3] / "admin" / "server"))

from api.db import FileType

from services import ResourceMgr


def test_folder_size_includes_all_descendant_files():
    rows = [
        {
            "id": "root",
            "workspace_id": "workspace-1",
            "parent_id": "root",
            "file_type": FileType.FOLDER.value,
            "size": 0,
        },
        {
            "id": "nested",
            "workspace_id": "workspace-1",
            "parent_id": "root",
            "file_type": FileType.FOLDER.value,
            "size": 0,
        },
        {
            "id": "direct-file",
            "workspace_id": "workspace-1",
            "parent_id": "root",
            "file_type": FileType.OTHER.value,
            "size": 3,
        },
        {
            "id": "nested-file",
            "workspace_id": "workspace-1",
            "parent_id": "nested",
            "file_type": FileType.OTHER.value,
            "size": 7,
        },
    ]

    ResourceMgr._attach_file_metrics(rows)

    sizes = {row["id"]: row["size"] for row in rows}
    assert sizes == {
        "root": 10,
        "nested": 7,
        "direct-file": 3,
        "nested-file": 7,
    }


def test_folder_size_does_not_mix_workspaces_or_loop_on_cycles():
    rows = [
        {
            "id": "root",
            "workspace_id": "workspace-1",
            "parent_id": "root",
            "file_type": FileType.FOLDER.value,
            "size": 0,
        },
        {
            "id": "file",
            "workspace_id": "workspace-1",
            "parent_id": "root",
            "file_type": FileType.OTHER.value,
            "size": 5,
        },
        {
            "id": "root",
            "workspace_id": "workspace-2",
            "parent_id": "root",
            "file_type": FileType.FOLDER.value,
            "size": 0,
        },
        {
            "id": "file",
            "workspace_id": "workspace-2",
            "parent_id": "root",
            "file_type": FileType.OTHER.value,
            "size": 11,
        },
        {
            "id": "cycle-a",
            "workspace_id": "workspace-1",
            "parent_id": "cycle-b",
            "file_type": FileType.FOLDER.value,
            "size": 0,
        },
        {
            "id": "cycle-b",
            "workspace_id": "workspace-1",
            "parent_id": "cycle-a",
            "file_type": FileType.FOLDER.value,
            "size": 0,
        },
    ]

    ResourceMgr._attach_file_metrics(rows)

    sizes = {(row["workspace_id"], row["id"]): row["size"] for row in rows}
    assert sizes[("workspace-1", "root")] == 5
    assert sizes[("workspace-2", "root")] == 11
    assert sizes[("workspace-1", "cycle-a")] == 0
    assert sizes[("workspace-1", "cycle-b")] == 0
