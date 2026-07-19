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

import asyncio
import logging
from typing import Set

from api.apps import current_user, login_required
from api.db.services.workspace_service import TeamService, WorkspaceAccessService
from api.db.services.resource_quota_service import ResourceQuotaService
from api.utils.api_utils import get_json_result, get_request_json, server_error_response, validate_request
from api.utils.web_utils import send_invite_email
from common import settings
from common.constants import RetCode


_background_tasks: Set[asyncio.Task] = set()


def _finish_background_task(task: asyncio.Task) -> None:
    _background_tasks.discard(task)
    try:
        task.result()
    except asyncio.CancelledError:
        logging.warning("Team invitation email task was cancelled")
    except Exception:
        logging.exception("Failed to send team invitation email")


def _team_error(exc: Exception):
    if isinstance(exc, PermissionError):
        return get_json_result(data=False, message=str(exc), code=RetCode.FORBIDDEN)
    if isinstance(exc, LookupError):
        return get_json_result(data=False, message=str(exc), code=RetCode.NOT_FOUND)
    if isinstance(exc, ValueError):
        return get_json_result(data=False, message=str(exc), code=RetCode.ARGUMENT_ERROR)
    return server_error_response(exc)


@manager.route("/teams", methods=["POST"])  # noqa: F821
@login_required
@validate_request("name")
async def create_team():
    try:
        req = await get_request_json()
        return get_json_result(data=TeamService.create(current_user.id, req["name"]))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams", methods=["GET"])  # noqa: F821
@login_required
def list_teams():
    try:
        return get_json_result(data=TeamService.list_by_user_id(current_user.id))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/workspaces", methods=["GET"])  # noqa: F821
@login_required
def list_workspaces():
    try:
        workspaces = WorkspaceAccessService.list_visible_workspaces(current_user.id)
        quotas = ResourceQuotaService.get_workspace_quotas(
            [workspace["tenant_id"] for workspace in workspaces]
        )
        for workspace in workspaces:
            workspace["quota"] = quotas[workspace["tenant_id"]]
        return get_json_result(data=workspaces)
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/invitations", methods=["GET"])  # noqa: F821
@login_required
def list_invitations():
    try:
        return get_json_result(data=TeamService.list_invitations(current_user.id))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>", methods=["GET"])  # noqa: F821
@login_required
def get_team(team_id):
    try:
        return get_json_result(data=TeamService.get(current_user.id, team_id))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>", methods=["PATCH"])  # noqa: F821
@login_required
@validate_request("name")
async def update_team(team_id):
    try:
        req = await get_request_json()
        return get_json_result(data=TeamService.update(current_user.id, team_id, req["name"]))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>", methods=["DELETE"])  # noqa: F821
@login_required
def delete_team(team_id):
    try:
        TeamService.delete(current_user.id, team_id)
        return get_json_result(data=True)
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>/members", methods=["GET"])  # noqa: F821
@login_required
def list_members(team_id):
    try:
        return get_json_result(data=TeamService.list_members(current_user.id, team_id))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>/invitations", methods=["POST"])  # noqa: F821
@login_required
@validate_request("email")
async def invite_member(team_id):
    try:
        req = await get_request_json()
        user = TeamService.invite(current_user.id, team_id, req["email"])
        task = asyncio.create_task(
            send_invite_email(
                to_email=user.email,
                invite_url=settings.MAIL_FRONTEND_URL,
                tenant_id=team_id,
                inviter=current_user.nickname or current_user.email,
            )
        )
        _background_tasks.add(task)
        task.add_done_callback(_finish_background_task)
        return get_json_result(data={"id": user.id, "email": user.email, "nickname": user.nickname, "avatar": user.avatar})
    except Exception as exc:
        logging.exception("Failed to invite team member")
        return _team_error(exc)


@manager.route("/teams/<team_id>/invitations/accept", methods=["POST"])  # noqa: F821
@login_required
def accept_invitation(team_id):
    try:
        return get_json_result(data=TeamService.accept_invitation(current_user.id, team_id))
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>/members/<user_id>", methods=["DELETE"])  # noqa: F821
@login_required
def remove_member(team_id, user_id):
    try:
        TeamService.remove_member(current_user.id, team_id, user_id)
        return get_json_result(data=True)
    except Exception as exc:
        return _team_error(exc)


@manager.route("/teams/<team_id>/members/<user_id>", methods=["PATCH"])  # noqa: F821
@login_required
async def update_member(team_id, user_id):
    try:
        req = await get_request_json()
        if req.get("transfer_ownership") is True:
            TeamService.transfer_ownership(current_user.id, team_id, user_id)
        else:
            TeamService.update_member_role(current_user.id, team_id, user_id, req.get("role"))
        return get_json_result(data=True)
    except Exception as exc:
        return _team_error(exc)
