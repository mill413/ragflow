#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
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
from datetime import datetime, timedelta

from quart import request

from api.apps import current_user, login_required
from api.db.services.api_service import API4ConversationService
from api.db.services.workspace_service import WorkspaceAccessService
from api.utils.api_utils import get_data_error_result, get_json_result, server_error_response
from common.constants import RetCode


ALL_WORKSPACES_ID = "__all__"


def _resolve_stats_workspace_ids(user_id: str, requested_workspace_id: str | None) -> list[str]:
    visible_workspace_ids = WorkspaceAccessService.list_visible_workspace_ids(user_id)
    if not visible_workspace_ids:
        return []

    if requested_workspace_id == ALL_WORKSPACES_ID:
        return visible_workspace_ids

    if requested_workspace_id:
        return [requested_workspace_id] if requested_workspace_id in visible_workspace_ids else []

    # A request without a filter represents the actor's personal workspace.
    # Workspace-bound API tokens expose only their bound workspace here.
    return [user_id] if user_id in visible_workspace_ids else [visible_workspace_ids[0]]


@manager.route("/system/stats", methods=["GET"])  # noqa: F821
@login_required
def stats():
    try:
        requested_workspace_id = request.args.get("workspace_id")
        workspace_ids = _resolve_stats_workspace_ids(current_user.id, requested_workspace_id)
        if not workspace_ids:
            if requested_workspace_id:
                return get_json_result(code=RetCode.FORBIDDEN, message="Permission denied for this workspace.")
            return get_data_error_result(message="Tenant not found!")

        objs = API4ConversationService.stats(
            workspace_ids,
            request.args.get("from_date", (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d 00:00:00")),
            request.args.get("to_date", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
            "agent" if "canvas_id" in request.args else None,
        )

        res = {"pv": [], "uv": [], "speed": [], "tokens": [], "round": [], "thumb_up": []}

        for obj in objs:
            dt = obj["dt"]
            res["pv"].append((dt, obj["pv"]))
            res["uv"].append((dt, obj["uv"]))
            res["speed"].append((dt, float(obj["tokens"]) / (float(obj["duration"]) + 0.1)))  # +0.1 to avoid division by zero
            res["tokens"].append((dt, float(obj["tokens"]) / 1000.0))  # convert to thousands
            res["round"].append((dt, obj["round"]))
            res["thumb_up"].append((dt, obj["thumb_up"]))

        return get_json_result(data=res)
    except Exception as e:
        return server_error_response(e)
