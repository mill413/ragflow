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
import asyncio
import logging

from quart import request

from api.apps import current_user, login_required
from api.db import InputType
from api.db.services.connector_service import ConnectorService, SyncLogsService
from api.utils.api_utils import get_data_error_result, get_json_result, get_request_json
from api.utils.pagination_utils import validate_rest_api_page_size
from common.constants import RetCode, SUPPORTED_DATA_SOURCES, TaskStatus
from common.misc_utils import get_uuid

LOGGER = logging.getLogger(__name__)


def _is_supported_source(source: str) -> bool:
    return source in SUPPORTED_DATA_SOURCES


def _get_supported_connector(connector_id: str):
    exists, connector = ConnectorService.get_by_id(connector_id)
    if not exists or not _is_supported_source(connector.source):
        return None
    return connector


def _connector_auth_error(connector_id: str, user_id: str):
    """Return the connector authorization failure response and log the denial."""
    LOGGER.warning("connector access denied: connector_id=%s user_id=%s", connector_id, user_id)
    return get_json_result(data=False, message="No authorization.", code=RetCode.AUTHENTICATION_ERROR)


@manager.route("/connectors/<connector_id>", methods=["PATCH"])  # noqa: F821
@login_required
async def update_connector(connector_id):
    """Update an accessible connector's polling configuration."""
    if not ConnectorService.accessible(connector_id, current_user.id):
        return _connector_auth_error(connector_id, current_user.id)

    req = await get_request_json()
    if isinstance(req, dict) and isinstance(req.get("data"), dict):
        req = req["data"]

    conn = _get_supported_connector(connector_id)
    if conn is None:
        return get_data_error_result(message="Can't find this Connector!")

    should_sleep = False
    if req:
        update_fields = {fld: req[fld] for fld in ["prune_freq", "refresh_freq", "config", "timeout_secs"] if fld in req}
        if update_fields:
            update_fields["id"] = connector_id
            ConnectorService.update_by_id(connector_id, update_fields)
            should_sleep = True

        if req.get("reschedule"):
            ConnectorService.cancel_tasks(connector_id)
            ConnectorService.schedule_tasks(connector_id)
        elif req.get("status") in [TaskStatus.CANCEL, "CANCEL"]:
            ConnectorService.cancel_tasks(connector_id)
        elif req.get("status") in [TaskStatus.SCHEDULE, "SCHEDULE"]:
            ConnectorService.schedule_tasks(connector_id)

    if should_sleep:
        await asyncio.sleep(1)
    conn = _get_supported_connector(connector_id)
    if conn is None:
        return get_data_error_result(message="Can't find this Connector!")

    return get_json_result(data=conn.to_dict())


@manager.route("/connectors", methods=["POST"])  # noqa: F821
@login_required
async def create_connector():
    """Create a connector owned by the current tenant."""
    req = await get_request_json()
    if not req or not _is_supported_source(req.get("source", "")):
        return get_json_result(code=RetCode.ARGUMENT_ERROR, message="Unsupported data source.")

    if req:
        req["id"] = get_uuid()
        conn = {
            "id": req["id"],
            "tenant_id": current_user.id,
            "name": req["name"],
            "source": req["source"],
            "input_type": InputType.POLL,
            "config": req["config"],
            "refresh_freq": int(req.get("refresh_freq", 5)),
            "prune_freq": int(req.get("prune_freq", 5)),
            "timeout_secs": int(req.get("timeout_secs", 60 * 29)),
            "status": TaskStatus.UNSTART,
        }
        ConnectorService.save(**conn)

    await asyncio.sleep(1)
    e, conn = ConnectorService.get_by_id(req["id"])

    return get_json_result(data=conn.to_dict())


@manager.route("/connectors", methods=["GET"])  # noqa: F821
@login_required
def list_connector():
    """List connectors owned by the current tenant."""
    return get_json_result(
        data=[
            connector
            for connector in ConnectorService.list(current_user.id)
            if _is_supported_source(connector["source"])
        ]
    )


@manager.route("/connectors/<connector_id>", methods=["GET"])  # noqa: F821
@login_required
def get_connector(connector_id):
    """Return connector details when the current user can access it."""
    if not ConnectorService.accessible(connector_id, current_user.id):
        return _connector_auth_error(connector_id, current_user.id)

    conn = _get_supported_connector(connector_id)
    if conn is None:
        return get_data_error_result(message="Can't find this Connector!")
    return get_json_result(data=conn.to_dict())


@manager.route("/connectors/<connector_id>/logs", methods=["GET"])  # noqa: F821
@login_required
def list_logs(connector_id):
    """List sync logs for a connector the current user can access."""
    if not ConnectorService.accessible(connector_id, current_user.id):
        return _connector_auth_error(connector_id, current_user.id)
    if _get_supported_connector(connector_id) is None:
        return get_data_error_result(message="Can't find this Connector!")

    req = request.args.to_dict(flat=True)
    arr, total = SyncLogsService.list_sync_tasks(
        connector_id,
        int(req.get("page", 1)),
        validate_rest_api_page_size(int(req.get("page_size", 15))),
    )
    return get_json_result(data={"total": total, "logs": arr})


@manager.route("/connectors/<connector_id>/rebuild", methods=["POST"])  # noqa: F821
@login_required
async def rebuild(connector_id):
    """Schedule a rebuild for an accessible connector and knowledge base."""
    if not ConnectorService.accessible(connector_id, current_user.id):
        return _connector_auth_error(connector_id, current_user.id)
    if _get_supported_connector(connector_id) is None:
        return get_data_error_result(message="Can't find this Connector!")

    req = await get_request_json()
    if "kb_id" not in req:
        return get_json_result(code=RetCode.ARGUMENT_ERROR, message="required argument is missing: kb_id")

    err = ConnectorService.rebuild(req["kb_id"], connector_id, current_user.id)
    if err:
        return get_json_result(data=False, message=err, code=RetCode.SERVER_ERROR)
    return get_json_result(data=True)


@manager.route("/connectors/<connector_id>", methods=["DELETE"])  # noqa: F821
@login_required
def rm_connector(connector_id):
    """Delete an accessible connector after canceling its sync tasks."""
    if not ConnectorService.accessible(connector_id, current_user.id):
        return _connector_auth_error(connector_id, current_user.id)

    conn = _get_supported_connector(connector_id)
    if conn is None:
        return get_data_error_result(message="Can't find this Connector!")

    ConnectorService.cancel_tasks(connector_id)
    ConnectorService.delete_by_id(connector_id)
    return get_json_result(data=True)
