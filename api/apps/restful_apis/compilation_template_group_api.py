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

from quart import Response, request

from api.apps import current_user, login_required
from api.apps.restful_apis.utils.compilation_template_validation import validate_template_payload
from api.db.services.compilation_template_group_service import (
    CompilationTemplateGroupService,
    GroupValidationError,
)
from api.db.services.resource_reference_service import ResourceReferenceService
from api.db.services.workspace_service import WorkspaceAccessService
from api.utils.api_utils import (
    get_data_error_result,
    get_json_result,
    get_request_json,
    get_resource_in_use_result,
    server_error_response,
    validate_request,
)
from api.utils.pagination_utils import validate_rest_api_page_size
from common.exceptions import ResourceInUseException


_GROUP_NAME_MAX = 128
_GROUP_DESCRIPTION_MAX = 1024


def _group_response(group: dict) -> dict:
    data = dict(group)
    data.update(WorkspaceAccessService.get_resource_workspace_metadata(data))
    data["capabilities"] = WorkspaceAccessService.get_workspace_resource_capabilities(current_user.id, data)
    return data


def _visible_workspace_ids() -> list[str]:
    visible_ids = WorkspaceAccessService.list_visible_workspace_ids(current_user.id)
    workspace_id = request.args.get("workspace_id")
    if workspace_id:
        return [workspace_id] if workspace_id in visible_ids else []
    return visible_ids


def _validate_group_payload(req: dict, require_all: bool = True) -> str:
    if require_all:
        for key in ("name", "templates"):
            if key not in req:
                return f"Missing required field: {key}."

    name = req.get("name")
    if name is not None:
        if not isinstance(name, str) or not name.strip():
            return "Invalid template group name."
        if len(name.encode("utf-8")) > _GROUP_NAME_MAX:
            return "Template group name is too long."

    description = req.get("description")
    if description is not None and (not isinstance(description, str) or len(description) > _GROUP_DESCRIPTION_MAX):
        return "Invalid template group description."

    templates = req.get("templates")
    if templates is not None:
        if not isinstance(templates, list) or not templates:
            return "A template group must contain at least one template."
        for child in templates:
            if not isinstance(child, dict):
                return "Invalid template entry in group."
            err = validate_template_payload(child, require_all=True)
            if err:
                return err
    return ""


@manager.route("/compilation_template_groups", methods=["GET"])  # noqa: F821
@login_required
def list_groups() -> Response:
    keywords = request.args.get("keywords", "")
    scope = request.args.get("scope", "")
    page_number = int(request.args.get("page", 0))
    items_per_page = validate_rest_api_page_size(int(request.args.get("page_size", 0)))
    orderby = request.args.get("orderby", "create_time")
    desc = request.args.get("desc", "true").lower() != "false"

    try:
        groups = CompilationTemplateGroupService.list_saved_by_tenant_ids(_visible_workspace_ids(), keywords, scope, orderby, desc)
        total = len(groups)
        if page_number and items_per_page:
            groups = groups[(page_number - 1) * items_per_page : page_number * items_per_page]
        return get_json_result(data={"groups": [_group_response(group) for group in groups], "total": total})
    except Exception as exc:
        return server_error_response(exc)


@manager.route("/compilation_template_groups/<group_id>", methods=["GET"])  # noqa: F821
@login_required
def detail(group_id: str) -> Response:
    try:
        exists, stored_group = CompilationTemplateGroupService.get_by_id(group_id)
        if not exists or not WorkspaceAccessService.can_read_workspace_resource(current_user.id, stored_group):
            return get_data_error_result(message=f"Cannot find compilation template group {group_id}.")
        group = CompilationTemplateGroupService.get_saved(group_id, stored_group.tenant_id)
        return get_json_result(data=_group_response(group))
    except Exception as exc:
        return server_error_response(exc)


@manager.route("/compilation_template_groups", methods=["POST"])  # noqa: F821
@login_required
@validate_request("name", "templates")
async def create() -> Response:
    req = await get_request_json()
    workspace_id = req.pop("workspace_id", current_user.id)
    if not WorkspaceAccessService.can_create_shared_resource(current_user.id, workspace_id):
        return get_data_error_result(message="No authorization.")
    error = _validate_group_payload(req)
    if error:
        return get_data_error_result(message=error)

    name = req["name"].strip()
    if CompilationTemplateGroupService.name_exists(workspace_id, name):
        return get_data_error_result(message="Duplicated compilation template group name.")

    try:
        saved = CompilationTemplateGroupService.create_group(
            tenant_id=workspace_id,
            name=name,
            description=req.get("description", ""),
            templates=req["templates"],
        )
        return get_json_result(data=_group_response(saved))
    except GroupValidationError as exc:
        return get_data_error_result(message=str(exc))
    except Exception as exc:
        return server_error_response(exc)


@manager.route("/compilation_template_groups/<group_id>", methods=["PUT"])  # noqa: F821
@login_required
async def update(group_id: str) -> Response:
    req = await get_request_json()
    error = _validate_group_payload(req, require_all=False)
    if error:
        return get_data_error_result(message=error)

    exists, stored_group = CompilationTemplateGroupService.get_by_id(group_id)
    if not exists or not WorkspaceAccessService.can_manage_workspace_resource(current_user.id, stored_group):
        return get_data_error_result(message=f"Cannot find compilation template group {group_id}.")
    workspace_id = stored_group.tenant_id

    name = req.get("name")
    if isinstance(name, str):
        name = name.strip()
        if CompilationTemplateGroupService.name_exists(workspace_id, name, group_id):
            return get_data_error_result(message="Duplicated compilation template group name.")

    try:
        updated = CompilationTemplateGroupService.update_group(
            group_id=group_id,
            tenant_id=workspace_id,
            name=name if isinstance(name, str) else None,
            description=req.get("description") if "description" in req else None,
            templates=req.get("templates") if "templates" in req else None,
        )
        if updated is None:
            return get_data_error_result(message=f"Cannot find compilation template group {group_id}.")
        return get_json_result(data=_group_response(updated))
    except GroupValidationError as exc:
        return get_data_error_result(message=str(exc))
    except Exception as exc:
        return server_error_response(exc)


@manager.route("/compilation_template_groups/<group_id>", methods=["DELETE"])  # noqa: F821
@login_required
def delete(group_id: str) -> Response:
    try:
        exists, stored_group = CompilationTemplateGroupService.get_by_id(group_id)
        if not exists or not WorkspaceAccessService.can_manage_workspace_resource(current_user.id, stored_group):
            return get_data_error_result(message=f"Cannot find compilation template group {group_id}.")
        ResourceReferenceService.ensure_not_referenced("compilation_template", [stored_group])
        ok = CompilationTemplateGroupService.delete_group(group_id, stored_group.tenant_id)
        if not ok:
            return get_data_error_result(message=f"Cannot find compilation template group {group_id}.")
        return get_json_result(data=True)
    except ResourceInUseException as exc:
        return get_resource_in_use_result(exc)
    except Exception as exc:
        return server_error_response(exc)
