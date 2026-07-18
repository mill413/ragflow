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

import inspect
from functools import wraps

from quart import g, request

from api.db import WorkspaceType
from api.db.services.workspace_service import WorkspaceAccessService
from api.utils.api_utils import get_error_data_result
from common.constants import RetCode


def personal_workspace_required(func):
    """Restrict an endpoint to the authenticated user's personal workspace."""

    @wraps(func)
    async def wrapper(*args, **kwargs):
        from api.apps import current_user

        actor_id = current_user.id
        requested_workspace_id = request.args.get("workspace_id")
        token_workspace_id = getattr(g, "api_token_workspace_id", None)
        is_personal = WorkspaceAccessService.get_workspace_type(actor_id) == WorkspaceType.PERSONAL
        if token_workspace_id not in (None, actor_id) or (requested_workspace_id and requested_workspace_id != actor_id) or not is_personal:
            return get_error_data_result(message="This resource is only available in a personal workspace.", code=RetCode.FORBIDDEN)

        if inspect.iscoroutinefunction(func):
            return await func(*args, **kwargs)
        return func(*args, **kwargs)

    return wrapper


def workspace_required(*, write: bool = False):
    """Resolve and authorize a workspace-scoped API request."""

    def decorator(func):
        @wraps(func)
        async def wrapper(**kwargs):
            actor_id = kwargs.get("tenant_id")
            target_id = request.args.get("workspace_id") or request.args.get("owner_tenant_id") or actor_id
            workspace_type = WorkspaceAccessService.get_workspace_type(target_id)

            can_read = target_id in WorkspaceAccessService.list_visible_workspace_ids(actor_id)
            if write:
                if workspace_type == WorkspaceType.PERSONAL:
                    allowed = target_id == actor_id and WorkspaceAccessService.is_member(actor_id, target_id)
                else:
                    allowed = WorkspaceAccessService.can_manage_workspace(actor_id, target_id)
            else:
                allowed = bool(workspace_type and can_read)

            if not allowed:
                return get_error_data_result(message="Permission denied", code=RetCode.FORBIDDEN)

            kwargs["tenant_id"] = target_id
            if "workspace_actor_id" in inspect.signature(func).parameters:
                kwargs["workspace_actor_id"] = actor_id
            if inspect.iscoroutinefunction(func):
                return await func(**kwargs)
            return func(**kwargs)

        return wrapper

    return decorator
