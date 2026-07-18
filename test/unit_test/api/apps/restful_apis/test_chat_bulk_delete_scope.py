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
from pathlib import Path
from types import SimpleNamespace


def _load_list_manageable_chat_ids():
    repo_root = Path(__file__).resolve().parents[5]
    source_path = repo_root / "api/apps/restful_apis/chat_api.py"
    tree = ast.parse(source_path.read_text())
    function = next(
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name == "_list_manageable_chat_ids"
    )
    module = ast.Module(body=[function], type_ignores=[])
    namespace = {}
    exec(compile(module, str(source_path), "exec"), namespace)
    return namespace["_list_manageable_chat_ids"]


def test_list_manageable_chat_ids_includes_personal_and_managed_teams():
    list_manageable_chat_ids = _load_list_manageable_chat_ids()
    chats = [
        {"id": "personal-chat", "tenant_id": "user-1"},
        {"id": "managed-team-chat", "tenant_id": "team-admin"},
        {"id": "readonly-team-chat", "tenant_id": "team-member"},
    ]
    captured = {}

    class DialogService:
        @staticmethod
        def get_by_tenant_ids(workspace_ids, user_id, page, page_size, orderby, desc, keywords):
            captured["query"] = (workspace_ids, user_id, page, page_size, orderby, desc, keywords)
            return chats, len(chats)

    workspace_access = SimpleNamespace(
        list_visible_workspace_ids=lambda user_id: [user_id, "team-admin", "team-member"],
        can_manage_shared_resource=lambda user_id, chat: chat["tenant_id"] != "team-member",
    )
    list_manageable_chat_ids.__globals__.update(
        DialogService=DialogService,
        WorkspaceAccessService=workspace_access,
    )

    assert list_manageable_chat_ids("user-1") == ["personal-chat", "managed-team-chat"]
    assert captured["query"] == (
        ["user-1", "team-admin", "team-member"],
        "user-1",
        0,
        0,
        "create_time",
        True,
        "",
    )
