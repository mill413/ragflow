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

from collections.abc import Mapping
import hashlib
import json
from typing import Any
from urllib.parse import urlparse

from quart import g, has_request_context

from api.db import KNOWLEDGEBASE_FOLDER_NAME, SKILLS_FOLDER_NAME, TenantPermission, UserTenantRole, WorkspaceType
from api.db.db_models import (
    APIToken,
    CompilationTemplate,
    CompilationTemplateGroup,
    Connector,
    DB,
    Dialog,
    File,
    File2Document,
    FileCommit,
    FileCommitItem,
    Knowledgebase,
    Memory,
    MCPServer,
    Search,
    Tenant,
    TenantLLM,
    TenantModel,
    TenantModelGroupMapping,
    TenantModelInstance,
    TenantModelProvider,
    UserCanvas,
    UserTenant,
)
from api.db.services.user_service import TenantService, UserService, UserTenantService
from common import settings
from common.constants import StatusEnum
from common.misc_utils import get_uuid


class WorkspaceAccessService:
    ACTIVE_MEMBER_ROLES = frozenset({UserTenantRole.OWNER, UserTenantRole.ADMIN, UserTenantRole.NORMAL})
    MANAGER_ROLES = frozenset({UserTenantRole.OWNER, UserTenantRole.ADMIN})

    @staticmethod
    def _value(record: Mapping[str, Any] | Any, field: str, default=None):
        if isinstance(record, Mapping):
            return record.get(field, default)
        return getattr(record, field, default)

    @staticmethod
    def is_superuser(user_id: str) -> bool:
        return UserService.is_admin(user_id)

    @staticmethod
    def _api_token_scope_allows(tenant_id: str) -> bool:
        if not has_request_context():
            return True
        token_workspace_id = getattr(g, "api_token_workspace_id", None)
        return token_workspace_id is None or token_workspace_id == tenant_id

    @classmethod
    def list_visible_workspace_ids(cls, user_id: str) -> list[str]:
        token_workspace_id = getattr(g, "api_token_workspace_id", None) if has_request_context() else None
        if cls.is_superuser(user_id):
            tenant_ids = Tenant.select(Tenant.id).where(Tenant.status == StatusEnum.VALID.value).tuples()
            workspace_ids = [tenant_id for (tenant_id,) in tenant_ids]
        else:
            workspace_ids = [workspace["tenant_id"] for workspace in TenantService.list_accessible_by_user_id(user_id)]
        if token_workspace_id is not None:
            return [token_workspace_id] if token_workspace_id in workspace_ids else []
        return workspace_ids

    @classmethod
    def list_visible_workspaces(cls, user_id: str) -> list[dict[str, Any]]:
        workspace_ids = cls.list_visible_workspace_ids(user_id)
        tenants = TenantService.get_by_ids(workspace_ids)
        users = UserService.get_by_ids(workspace_ids)
        user_map = {user.id: user for user in users}
        workspaces = []
        for tenant in tenants:
            workspace_type = cls.get_workspace_type(tenant.id)
            if not workspace_type:
                continue
            membership = cls.get_membership(user_id, tenant.id)
            name = tenant.name or ""
            if workspace_type == WorkspaceType.PERSONAL:
                owner = user_map.get(tenant.id)
                name = cls._value(owner, "nickname") or cls._value(owner, "email") or name
            workspaces.append(
                {
                    "tenant_id": tenant.id,
                    "name": name,
                    "role": cls._value(membership, "role"),
                    "workspace_type": workspace_type,
                    "capabilities": cls.get_workspace_capabilities(user_id, tenant.id),
                }
            )
        return sorted(
            workspaces,
            key=lambda workspace: (
                workspace["tenant_id"] != user_id,
                workspace["workspace_type"] != WorkspaceType.PERSONAL,
                workspace["name"].casefold(),
            ),
        )

    @classmethod
    def get_workspace_type(cls, tenant_id: str) -> WorkspaceType | None:
        tenant_exists, tenant = TenantService.get_by_id(tenant_id)
        if not tenant_exists or cls._value(tenant, "status") != StatusEnum.VALID.value:
            return None

        owners = UserTenantService.query(tenant_id=tenant_id, role=UserTenantRole.OWNER, status=StatusEnum.VALID.value)
        if not owners:
            return None

        if any(cls._value(owner, "user_id") == tenant_id for owner in owners):
            user_exists, user = UserService.get_by_id(tenant_id)
            if user_exists and cls._value(user, "status") == StatusEnum.VALID.value:
                return WorkspaceType.PERSONAL

        return WorkspaceType.TEAM

    @classmethod
    def get_workspace_owner_id(cls, tenant_id: str) -> str | None:
        if not cls.get_workspace_type(tenant_id):
            return None
        owners = UserTenantService.query(tenant_id=tenant_id, role=UserTenantRole.OWNER, status=StatusEnum.VALID.value)
        return cls._value(owners[0], "user_id") if owners else None

    @classmethod
    def get_resource_workspace_metadata(
        cls,
        resource: Mapping[str, Any] | Any,
        *,
        workspace_field: str = "tenant_id",
        creator_field: str = "created_by",
    ) -> dict[str, str | WorkspaceType | None]:
        tenant_id = cls._value(resource, workspace_field)
        workspace_type = cls.get_workspace_type(tenant_id)
        workspace_exists, workspace = TenantService.get_by_id(tenant_id)

        creator_id = cls._value(resource, creator_field)
        if not creator_id and workspace_type == WorkspaceType.PERSONAL:
            creator_id = tenant_id
        creator_exists, creator = UserService.get_by_id(creator_id) if creator_id else (False, None)

        return {
            "workspace_type": workspace_type,
            "workspace_name": cls._value(workspace, "name", "") if workspace_exists else "",
            "creator_name": (
                cls._value(creator, "nickname", "") or cls._value(creator, "email", "")
                if creator_exists
                else ""
            ),
        }

    @classmethod
    def get_membership(cls, user_id: str, tenant_id: str):
        membership = UserTenantService.filter_by_tenant_and_user_id(tenant_id, user_id)
        if not membership or cls._value(membership, "status") != StatusEnum.VALID.value:
            return None
        return membership

    @classmethod
    def is_member(cls, user_id: str, tenant_id: str) -> bool:
        membership = cls.get_membership(user_id, tenant_id)
        return bool(membership and cls._value(membership, "role") in cls.ACTIVE_MEMBER_ROLES)

    @classmethod
    def can_manage_workspace(cls, user_id: str, tenant_id: str) -> bool:
        if not cls._api_token_scope_allows(tenant_id):
            return False
        if cls.get_workspace_type(tenant_id) != WorkspaceType.TEAM:
            return False
        if cls.is_superuser(user_id):
            return True
        membership = cls.get_membership(user_id, tenant_id)
        return bool(membership and cls._value(membership, "role") in cls.MANAGER_ROLES)

    @classmethod
    def can_create_knowledgebase(cls, user_id: str, tenant_id: str) -> bool:
        if not cls._api_token_scope_allows(tenant_id):
            return False
        workspace_type = cls.get_workspace_type(tenant_id)
        if workspace_type and cls.is_superuser(user_id):
            return True
        if workspace_type == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        if workspace_type == WorkspaceType.TEAM:
            return cls.can_manage_workspace(user_id, tenant_id)
        return False

    @classmethod
    def can_create_shared_resource(cls, user_id: str, tenant_id: str) -> bool:
        if not cls._api_token_scope_allows(tenant_id):
            return False
        workspace_type = cls.get_workspace_type(tenant_id)
        if workspace_type and cls.is_superuser(user_id):
            return True
        if workspace_type == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        if workspace_type == WorkspaceType.TEAM:
            return cls.can_manage_workspace(user_id, tenant_id)
        return False

    @classmethod
    def can_create_collaborative_resource(cls, user_id: str, tenant_id: str) -> bool:
        """Allow every active team member to create chats, agents, searches, and memories."""
        if not cls._api_token_scope_allows(tenant_id):
            return False
        workspace_type = cls.get_workspace_type(tenant_id)
        if workspace_type and cls.is_superuser(user_id):
            return True
        if workspace_type == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        if workspace_type == WorkspaceType.TEAM:
            return cls.is_member(user_id, tenant_id)
        return False

    @classmethod
    def can_read_workspace_resource(cls, user_id: str, resource: Mapping[str, Any] | Any, *, workspace_field: str = "tenant_id") -> bool:
        tenant_id = cls._value(resource, workspace_field)
        return bool(tenant_id and tenant_id in cls.list_visible_workspace_ids(user_id))

    @classmethod
    def can_manage_workspace_resource(cls, user_id: str, resource: Mapping[str, Any] | Any, *, workspace_field: str = "tenant_id") -> bool:
        tenant_id = cls._value(resource, workspace_field)
        if not cls.can_read_workspace_resource(user_id, resource, workspace_field=workspace_field):
            return False
        if cls.is_superuser(user_id):
            return True
        if cls.get_workspace_type(tenant_id) == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        return cls.can_manage_workspace(user_id, tenant_id)

    @classmethod
    def get_workspace_resource_capabilities(cls, user_id: str, resource: Mapping[str, Any] | Any, *, workspace_field: str = "tenant_id") -> dict[str, bool]:
        return {
            "read": cls.can_read_workspace_resource(user_id, resource, workspace_field=workspace_field),
            "update": cls.can_manage_workspace_resource(user_id, resource, workspace_field=workspace_field),
            "delete": cls.can_manage_workspace_resource(user_id, resource, workspace_field=workspace_field),
        }

    @classmethod
    def can_read_shared_resource(
        cls,
        user_id: str,
        resource: Mapping[str, Any] | Any,
        *,
        workspace_field: str = "tenant_id",
        permission_field: str | None = None,
    ) -> bool:
        status = cls._value(resource, "status")
        if status is not None and status != StatusEnum.VALID.value:
            return False

        tenant_id = cls._value(resource, workspace_field)
        if not cls._api_token_scope_allows(tenant_id):
            return False
        workspace_type = cls.get_workspace_type(tenant_id)
        permission = cls._value(resource, permission_field) if permission_field else None
        if workspace_type and cls.is_superuser(user_id):
            return True
        if workspace_type == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id) and (permission_field is None or permission == TenantPermission.ME)
        if workspace_type == WorkspaceType.TEAM:
            return cls.is_member(user_id, tenant_id) and (permission_field is None or permission == TenantPermission.TEAM)
        return False

    @classmethod
    def can_manage_shared_resource(
        cls,
        user_id: str,
        resource: Mapping[str, Any] | Any,
        *,
        workspace_field: str = "tenant_id",
        permission_field: str | None = None,
    ) -> bool:
        if not cls.can_read_shared_resource(
            user_id,
            resource,
            workspace_field=workspace_field,
            permission_field=permission_field,
        ):
            return False

        tenant_id = cls._value(resource, workspace_field)
        if cls.is_superuser(user_id):
            return True
        if cls.get_workspace_type(tenant_id) == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        return cls.can_manage_workspace(user_id, tenant_id)

    @classmethod
    def get_shared_resource_capabilities(
        cls,
        user_id: str,
        resource: Mapping[str, Any] | Any,
        *,
        workspace_field: str = "tenant_id",
        permission_field: str | None = None,
    ) -> dict[str, bool]:
        return {
            "read": cls.can_read_shared_resource(
                user_id,
                resource,
                workspace_field=workspace_field,
                permission_field=permission_field,
            ),
            "update": cls.can_manage_shared_resource(
                user_id,
                resource,
                workspace_field=workspace_field,
                permission_field=permission_field,
            ),
            "delete": cls.can_manage_shared_resource(
                user_id,
                resource,
                workspace_field=workspace_field,
                permission_field=permission_field,
            ),
        }

    @classmethod
    def can_manage_collaborative_resource(
        cls,
        user_id: str,
        resource: Mapping[str, Any] | Any,
        *,
        workspace_field: str = "tenant_id",
        permission_field: str | None = None,
    ) -> bool:
        """Allow active team members to manage chats, agents, searches, and memories."""
        if not cls.can_read_shared_resource(
            user_id,
            resource,
            workspace_field=workspace_field,
            permission_field=permission_field,
        ):
            return False

        tenant_id = cls._value(resource, workspace_field)
        if cls.is_superuser(user_id):
            return True
        if cls.get_workspace_type(tenant_id) == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        return cls.is_member(user_id, tenant_id)

    @classmethod
    def get_collaborative_resource_capabilities(
        cls,
        user_id: str,
        resource: Mapping[str, Any] | Any,
        *,
        workspace_field: str = "tenant_id",
        permission_field: str | None = None,
    ) -> dict[str, bool]:
        can_read = cls.can_read_shared_resource(
            user_id,
            resource,
            workspace_field=workspace_field,
            permission_field=permission_field,
        )
        can_manage = cls.can_manage_collaborative_resource(
            user_id,
            resource,
            workspace_field=workspace_field,
            permission_field=permission_field,
        )
        return {"read": can_read, "update": can_manage, "delete": can_manage}

    @classmethod
    def can_read_knowledgebase(cls, user_id: str, knowledgebase: Mapping[str, Any] | Any) -> bool:
        if cls._value(knowledgebase, "status") != StatusEnum.VALID.value:
            return False

        tenant_id = cls._value(knowledgebase, "tenant_id")
        if not cls._api_token_scope_allows(tenant_id):
            return False
        workspace_type = cls.get_workspace_type(tenant_id)
        permission = cls._value(knowledgebase, "permission")

        if workspace_type and cls.is_superuser(user_id):
            return True

        if workspace_type == WorkspaceType.PERSONAL:
            return permission == TenantPermission.ME and tenant_id == user_id and cls.is_member(user_id, tenant_id)
        if workspace_type == WorkspaceType.TEAM:
            return permission == TenantPermission.TEAM and cls.is_member(user_id, tenant_id)
        return False

    @classmethod
    def can_update_knowledgebase(cls, user_id: str, knowledgebase: Mapping[str, Any] | Any) -> bool:
        if not cls.can_read_knowledgebase(user_id, knowledgebase):
            return False

        tenant_id = cls._value(knowledgebase, "tenant_id")
        if cls.is_superuser(user_id):
            return True
        if cls.get_workspace_type(tenant_id) == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        return cls.can_manage_workspace(user_id, tenant_id)

    @classmethod
    def can_manage_file(cls, user_id: str, file: Mapping[str, Any] | Any) -> bool:
        tenant_id = cls._value(file, "tenant_id")
        if not cls._api_token_scope_allows(tenant_id):
            return False
        workspace_type = cls.get_workspace_type(tenant_id)
        if workspace_type and cls.is_superuser(user_id):
            return True
        if workspace_type == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        if workspace_type == WorkspaceType.TEAM:
            return cls.can_manage_workspace(user_id, tenant_id)
        return False

    @classmethod
    def can_reference_knowledgebases(cls, user_id: str, workspace_id: str, knowledgebase_ids: list[str] | tuple[str, ...] | set[str]) -> bool:
        if not cls._api_token_scope_allows(workspace_id):
            return False
        for knowledgebase_id in set(knowledgebase_ids or []):
            knowledgebase = Knowledgebase.get_or_none(id=knowledgebase_id, status=StatusEnum.VALID.value)
            if not knowledgebase or knowledgebase.tenant_id != workspace_id:
                return False
            if not cls.can_read_knowledgebase(user_id, knowledgebase):
                return False
        return True

    @classmethod
    def can_reference_connectors(cls, user_id: str, workspace_id: str, connector_ids: list[str] | tuple[str, ...] | set[str]) -> bool:
        for connector_id in set(connector_ids or []):
            connector = Connector.get_or_none(id=connector_id)
            if not connector or connector.tenant_id != workspace_id or not cls.can_read_workspace_resource(user_id, connector):
                return False
        return True

    @classmethod
    def can_reference_mcp_servers(cls, user_id: str, workspace_id: str, mcp_ids: list[str] | tuple[str, ...] | set[str]) -> bool:
        for mcp_id in set(mcp_ids or []):
            server = MCPServer.get_or_none(id=mcp_id)
            if not server or server.tenant_id != workspace_id or not cls.can_read_workspace_resource(user_id, server):
                return False
        return True

    @classmethod
    def can_reference_memories(cls, user_id: str, workspace_id: str, memory_ids: list[str] | tuple[str, ...] | set[str]) -> bool:
        for memory_id in set(memory_ids or []):
            memory = Memory.get_or_none(id=memory_id)
            if not memory or memory.tenant_id != workspace_id or not cls.can_read_workspace_resource(user_id, memory):
                return False
        return True

    @classmethod
    def can_reference_files(cls, user_id: str, workspace_id: str, file_ids: list[str] | tuple[str, ...] | set[str]) -> bool:
        for file_id in set(file_ids or []):
            file = File.get_or_none(id=file_id)
            if not file or file.tenant_id != workspace_id or not cls.can_read_workspace_resource(user_id, file):
                return False
        return True

    @classmethod
    def can_reference_compilation_template_groups(cls, user_id: str, workspace_id: str, group_ids: list[str] | tuple[str, ...] | set[str]) -> bool:
        for group_id in set(group_ids or []):
            group = CompilationTemplateGroup.get_or_none(
                id=group_id,
                tenant_id=workspace_id,
                status=StatusEnum.VALID.value,
            )
            if not group or not cls.can_read_workspace_resource(user_id, group):
                return False
        return True

    @classmethod
    def can_read_conversation(
        cls,
        user_id: str,
        dialog: Mapping[str, Any] | Any,
        conversation: Mapping[str, Any] | Any,
    ) -> bool:
        dialog_id = cls._value(dialog, "id")
        if not dialog_id or cls._value(conversation, "dialog_id") != dialog_id:
            return False
        if not cls.can_read_shared_resource(user_id, dialog):
            return False

        workspace_id = cls._value(dialog, "tenant_id")
        if cls.get_workspace_type(workspace_id) == WorkspaceType.TEAM:
            return True
        return cls.is_superuser(user_id) or cls._value(conversation, "user_id") == user_id

    @classmethod
    def can_manage_conversation(
        cls,
        user_id: str,
        dialog: Mapping[str, Any] | Any,
        conversation: Mapping[str, Any] | Any,
    ) -> bool:
        if not cls.can_read_conversation(user_id, dialog, conversation):
            return False
        if cls.is_superuser(user_id):
            return True

        workspace_id = cls._value(dialog, "tenant_id")
        if cls.get_workspace_type(workspace_id) == WorkspaceType.TEAM:
            return cls.is_member(user_id, workspace_id)
        return cls._value(conversation, "user_id") == user_id

    @classmethod
    def can_read_agent_session(
        cls,
        user_id: str,
        agent: Mapping[str, Any] | Any,
        session: Mapping[str, Any] | Any,
    ) -> bool:
        agent_id = cls._value(agent, "id")
        if not agent_id or cls._value(session, "dialog_id") != agent_id:
            return False
        if not cls.can_read_shared_resource(
            user_id,
            agent,
            workspace_field="user_id",
            permission_field="permission",
        ):
            return False

        workspace_id = cls._value(agent, "user_id")
        if cls.get_workspace_type(workspace_id) == WorkspaceType.TEAM:
            return True
        return cls.is_superuser(user_id) or cls._value(session, "user_id") == user_id

    @classmethod
    def can_manage_agent_session(
        cls,
        user_id: str,
        agent: Mapping[str, Any] | Any,
        session: Mapping[str, Any] | Any,
    ) -> bool:
        if not cls.can_read_agent_session(user_id, agent, session):
            return False
        if cls.is_superuser(user_id):
            return True

        workspace_id = cls._value(agent, "user_id")
        if cls.get_workspace_type(workspace_id) == WorkspaceType.TEAM:
            return cls.is_member(user_id, workspace_id)
        return cls._value(session, "user_id") == user_id

    @classmethod
    def get_agent_session_capabilities(
        cls,
        user_id: str,
        agent: Mapping[str, Any] | Any,
        session: Mapping[str, Any] | Any,
    ) -> dict[str, bool]:
        return {
            "read": cls.can_read_agent_session(user_id, agent, session),
            "update": cls.can_manage_agent_session(user_id, agent, session),
            "delete": cls.can_manage_agent_session(user_id, agent, session),
        }

    @classmethod
    def extract_knowledgebase_ids(cls, value: Any) -> set[str]:
        knowledgebase_ids: set[str] = set()

        def visit(item: Any) -> None:
            if isinstance(item, Mapping):
                for key, nested in item.items():
                    if key in {"dataset_ids", "kb_ids"} and isinstance(nested, (list, tuple, set)):
                        knowledgebase_ids.update(identifier for identifier in nested if isinstance(identifier, str) and identifier and "@" not in identifier)
                    else:
                        visit(nested)
            elif isinstance(item, (list, tuple, set)):
                for nested in item:
                    visit(nested)

        visit(value)
        return knowledgebase_ids

    @classmethod
    def extract_reference_ids(cls, value: Any, keys: set[str]) -> set[str]:
        reference_ids: set[str] = set()

        def visit(item: Any) -> None:
            if isinstance(item, Mapping):
                for key, nested in item.items():
                    if key in keys:
                        if isinstance(nested, str) and nested:
                            reference_ids.add(nested)
                        elif isinstance(nested, (list, tuple, set)):
                            reference_ids.update(identifier for identifier in nested if isinstance(identifier, str) and identifier)
                    else:
                        visit(nested)
            elif isinstance(item, (list, tuple, set)):
                for nested in item:
                    visit(nested)

        visit(value)
        return reference_ids

    @classmethod
    def extract_static_file_ids(cls, value: Any) -> set[str]:
        file_ids: set[str] = set()

        def is_http_url(token: str) -> bool:
            parsed = urlparse(token)
            return parsed.scheme in {"http", "https"} and bool(parsed.netloc)

        def collect(item: Any) -> None:
            if item is None:
                return
            if isinstance(item, str):
                token = item.strip()
                if not token or "@" in token or is_http_url(token):
                    return
                if token.startswith("[") and token.endswith("]"):
                    try:
                        collect(json.loads(token))
                        return
                    except (TypeError, ValueError, json.JSONDecodeError):
                        pass
                if "," in token:
                    for part in token.split(","):
                        collect(part)
                    return
                file_ids.add(token)
                return
            if isinstance(item, Mapping):
                for key in ("file_id", "id"):
                    if key in item:
                        collect(item[key])
                        return
                for nested in item.values():
                    collect(nested)
                return
            if isinstance(item, (list, tuple, set)):
                for nested in item:
                    collect(nested)

        def visit(item: Any) -> None:
            if isinstance(item, Mapping):
                for key, nested in item.items():
                    if key in {"upload_sources", "input_files"}:
                        collect(nested)
                    else:
                        visit(nested)
            elif isinstance(item, (list, tuple, set)):
                for nested in item:
                    visit(nested)

        visit(value)
        return file_ids

    @classmethod
    def can_delete_knowledgebase(cls, user_id: str, knowledgebase: Mapping[str, Any] | Any) -> bool:
        return cls.can_update_knowledgebase(user_id, knowledgebase)

    @classmethod
    def get_workspace_capabilities(cls, user_id: str, tenant_id: str) -> dict[str, bool]:
        workspace_type = cls.get_workspace_type(tenant_id)
        membership = cls.get_membership(user_id, tenant_id)
        role = cls._value(membership, "role") if membership else None
        is_member = role in cls.ACTIVE_MEMBER_ROLES
        is_team = workspace_type == WorkspaceType.TEAM
        is_superuser = bool(workspace_type and cls.is_superuser(user_id))
        return {
            "read": bool(is_member or is_superuser),
            "create_knowledgebase": cls.can_create_knowledgebase(user_id, tenant_id),
            "create_shared_resource": cls.can_create_shared_resource(user_id, tenant_id),
            "create_collaborative_resource": cls.can_create_collaborative_resource(user_id, tenant_id),
            "manage_members": bool(is_team and (role in cls.MANAGER_ROLES or is_superuser)),
            "update": bool(is_team and (role in cls.MANAGER_ROLES or is_superuser)),
            "delete": bool(is_team and (role == UserTenantRole.OWNER or is_superuser)),
        }

    @classmethod
    def get_knowledgebase_capabilities(cls, user_id: str, knowledgebase: Mapping[str, Any] | Any) -> dict[str, bool]:
        return {
            "read": cls.can_read_knowledgebase(user_id, knowledgebase),
            "update": cls.can_update_knowledgebase(user_id, knowledgebase),
            "delete": cls.can_delete_knowledgebase(user_id, knowledgebase),
        }


class TeamService:
    @staticmethod
    def _lock_name(operation: str, *identifiers: str) -> str:
        digest = hashlib.sha256(":".join(identifiers).encode()).hexdigest()[:48]
        return f"team:{operation}:{digest}"

    @classmethod
    def create(cls, owner_id: str, name: str) -> dict[str, Any]:
        name = str(name or "").strip()
        if not name or len(name) > 100:
            raise ValueError("Team name must contain between 1 and 100 characters.")
        from api.db.services.resource_quota_service import ResourceQuotaService

        ResourceQuotaService.ensure_team_creation_allowed(owner_id)
        personal_membership = TenantService.get_personal_by_user_id(owner_id)
        exists, _personal = TenantService.get_by_id(owner_id)
        if not personal_membership or not exists:
            raise LookupError("Personal workspace not found.")
        tenant_id = get_uuid()
        with DB.atomic():
            payload = {
                "id": tenant_id,
                "name": name,
                "llm_id": settings.CHAT_MDL,
                "embd_id": settings.EMBEDDING_MDL,
                "asr_id": settings.ASR_MDL,
                "parser_ids": settings.PARSERS,
                "img2txt_id": settings.VISION_MDL,
                "rerank_id": settings.RERANK_MDL,
                "status": StatusEnum.VALID.value,
            }
            Tenant.insert(**payload).execute()
            UserTenant.insert(
                id=get_uuid(),
                user_id=owner_id,
                tenant_id=tenant_id,
                invited_by=owner_id,
                role=UserTenantRole.OWNER,
                status=StatusEnum.VALID.value,
            ).execute()
        return cls.get(owner_id, tenant_id)

    @classmethod
    def list_by_user_id(cls, user_id: str) -> list[dict[str, Any]]:
        if WorkspaceAccessService.is_superuser(user_id):
            return [workspace for workspace in WorkspaceAccessService.list_visible_workspaces(user_id) if workspace["workspace_type"] == WorkspaceType.TEAM]

        teams = []
        for workspace in TenantService.list_accessible_by_user_id(user_id):
            if workspace["tenant_id"] == user_id:
                continue
            item = dict(workspace)
            item["workspace_type"] = WorkspaceType.TEAM
            item["capabilities"] = WorkspaceAccessService.get_workspace_capabilities(user_id, item["tenant_id"])
            teams.append(item)
        return teams

    @classmethod
    def list_invitations(cls, user_id: str) -> list[dict[str, Any]]:
        invitations = []
        for membership in UserTenantService.list_memberships_by_user_id(user_id):
            if membership["role"] != UserTenantRole.INVITE or membership["status"] != StatusEnum.VALID.value:
                continue
            tenant_id = membership["tenant_id"]
            if WorkspaceAccessService.get_workspace_type(tenant_id) != WorkspaceType.TEAM:
                continue
            invitations.append(
                {
                    "tenant_id": tenant_id,
                    "name": membership["name"],
                    "role": UserTenantRole.INVITE,
                    "invited_by": membership["invited_by"],
                    "workspace_type": WorkspaceType.TEAM,
                }
            )
        return invitations

    @classmethod
    def get(cls, user_id: str, tenant_id: str) -> dict[str, Any]:
        if WorkspaceAccessService.get_workspace_type(tenant_id) != WorkspaceType.TEAM:
            raise LookupError("Team not found.")
        if not WorkspaceAccessService.is_member(user_id, tenant_id) and not WorkspaceAccessService.is_superuser(user_id):
            raise PermissionError("No authorization.")
        exists, tenant = TenantService.get_by_id(tenant_id)
        if not exists:
            raise LookupError("Team not found.")
        result = tenant.to_dict()
        result["tenant_id"] = result.pop("id")
        membership = WorkspaceAccessService.get_membership(user_id, tenant_id)
        result["role"] = WorkspaceAccessService._value(membership, "role")
        result["workspace_type"] = WorkspaceType.TEAM
        result["capabilities"] = WorkspaceAccessService.get_workspace_capabilities(user_id, tenant_id)
        return result

    @classmethod
    def update(cls, actor_id: str, tenant_id: str, name: str) -> dict[str, Any]:
        if not WorkspaceAccessService.can_manage_workspace(actor_id, tenant_id):
            raise PermissionError("No authorization.")
        name = str(name or "").strip()
        if not name or len(name) > 100:
            raise ValueError("Team name must contain between 1 and 100 characters.")
        TenantService.update_by_id(tenant_id, {"name": name})
        return cls.get(actor_id, tenant_id)

    @classmethod
    def list_members(cls, actor_id: str, tenant_id: str) -> list[dict[str, Any]]:
        if not WorkspaceAccessService.is_member(actor_id, tenant_id) and not WorkspaceAccessService.is_superuser(actor_id):
            raise PermissionError("No authorization.")
        return UserTenantService.get_by_tenant_id(tenant_id)

    @classmethod
    def invite(cls, actor_id: str, tenant_id: str, email: str):
        if not WorkspaceAccessService.can_manage_workspace(actor_id, tenant_id):
            raise PermissionError("No authorization.")
        users = UserService.query(email=str(email or "").strip())
        if not users:
            raise LookupError("User not found.")
        user = users[0]
        with DB.lock(cls._lock_name("member", tenant_id, user.id), 10):
            existing = UserTenantService.query(user_id=user.id, tenant_id=tenant_id)
            with DB.atomic():
                if existing:
                    relation = existing[0]
                    if relation.status == StatusEnum.VALID.value:
                        raise ValueError("User already has a membership or invitation.")
                    UserTenant.update(
                        role=UserTenantRole.INVITE,
                        invited_by=actor_id,
                        status=StatusEnum.VALID.value,
                    ).where(UserTenant.id == relation.id).execute()
                else:
                    UserTenant.insert(
                        id=get_uuid(),
                        user_id=user.id,
                        tenant_id=tenant_id,
                        invited_by=actor_id,
                        role=UserTenantRole.INVITE,
                        status=StatusEnum.VALID.value,
                    ).execute()
        return user

    @classmethod
    def accept_invitation(cls, user_id: str, tenant_id: str) -> dict[str, Any]:
        with DB.lock(cls._lock_name("member", tenant_id, user_id), 10):
            membership = WorkspaceAccessService.get_membership(user_id, tenant_id)
            if not membership or membership.role != UserTenantRole.INVITE:
                raise LookupError("Invitation not found.")
            with DB.atomic():
                UserTenant.update(role=UserTenantRole.NORMAL).where(UserTenant.id == membership.id).execute()
        return cls.get(user_id, tenant_id)

    @classmethod
    def remove_member(cls, actor_id: str, tenant_id: str, user_id: str) -> None:
        with DB.lock(cls._lock_name("member", tenant_id, user_id), 10):
            membership = WorkspaceAccessService.get_membership(user_id, tenant_id)
            if not membership:
                raise LookupError("Membership not found.")
            if membership.role == UserTenantRole.OWNER:
                raise ValueError("Transfer team ownership before removing the owner.")
            actor_membership = WorkspaceAccessService.get_membership(actor_id, tenant_id)
            actor_role = WorkspaceAccessService._value(actor_membership, "role") if actor_membership else None
            is_superuser = WorkspaceAccessService.is_superuser(actor_id)
            if actor_id != user_id and actor_role not in WorkspaceAccessService.MANAGER_ROLES and not is_superuser:
                raise PermissionError("No authorization.")
            if not is_superuser and actor_role == UserTenantRole.ADMIN and membership.role == UserTenantRole.ADMIN:
                raise PermissionError("Only the owner can remove an administrator.")
            with DB.atomic():
                UserTenant.update(status=StatusEnum.INVALID.value).where(UserTenant.id == membership.id).execute()

    @classmethod
    def update_member_role(cls, actor_id: str, tenant_id: str, user_id: str, role: str) -> None:
        if role not in {UserTenantRole.ADMIN, UserTenantRole.NORMAL}:
            raise ValueError("Role must be admin or normal.")
        with DB.lock(cls._lock_name("member", tenant_id, user_id), 10):
            if not WorkspaceAccessService.can_manage_workspace(actor_id, tenant_id):
                raise PermissionError("No authorization.")
            membership = WorkspaceAccessService.get_membership(user_id, tenant_id)
            if not membership:
                raise LookupError("Membership not found.")
            if membership.role == UserTenantRole.OWNER:
                raise ValueError("Use ownership transfer to change the owner.")
            with DB.atomic():
                UserTenant.update(role=role).where(UserTenant.id == membership.id).execute()

    @classmethod
    def transfer_ownership(cls, actor_id: str, tenant_id: str, user_id: str) -> None:
        with DB.lock(cls._lock_name("owner", tenant_id), 10):
            actor = WorkspaceAccessService.get_membership(actor_id, tenant_id)
            target = WorkspaceAccessService.get_membership(user_id, tenant_id)
            is_superuser = WorkspaceAccessService.is_superuser(actor_id)
            if not is_superuser and (not actor or actor.role != UserTenantRole.OWNER):
                raise PermissionError("Only the owner can transfer team ownership.")
            if not target or target.role not in WorkspaceAccessService.ACTIVE_MEMBER_ROLES:
                raise LookupError("Target member not found.")
            owners = UserTenantService.query(
                tenant_id=tenant_id,
                role=UserTenantRole.OWNER,
                status=StatusEnum.VALID.value,
            )
            if not owners:
                raise LookupError("Team owner not found.")
            owner = owners[0]
            if owner.user_id == user_id:
                return
            with DB.atomic():
                UserTenant.update(role=UserTenantRole.ADMIN).where(UserTenant.id == owner.id).execute()
                UserTenant.update(role=UserTenantRole.OWNER).where(UserTenant.id == target.id).execute()

    @classmethod
    def delete(cls, actor_id: str, tenant_id: str) -> None:
        if WorkspaceAccessService.get_workspace_type(tenant_id) != WorkspaceType.TEAM:
            raise LookupError("Team not found.")
        membership = WorkspaceAccessService.get_membership(actor_id, tenant_id)
        if not WorkspaceAccessService.is_superuser(actor_id) and (not membership or membership.role != UserTenantRole.OWNER):
            raise PermissionError("Only the owner can delete a team.")
        with DB.lock(cls._lock_name("delete", tenant_id), 10):
            team_files = File.select().where(
                (File.tenant_id == tenant_id)
                & ~(
                    (File.type == "folder")
                    & ((File.parent_id == File.id) | File.name.in_([KNOWLEDGEBASE_FOLDER_NAME, SKILLS_FOLDER_NAME]))
                )
            )
            resource_queries = (
                Knowledgebase.select().where((Knowledgebase.tenant_id == tenant_id) & (Knowledgebase.status == StatusEnum.VALID.value)),
                Dialog.select().where((Dialog.tenant_id == tenant_id) & (Dialog.status == StatusEnum.VALID.value)),
                Search.select().where((Search.tenant_id == tenant_id) & (Search.status == StatusEnum.VALID.value)),
                UserCanvas.select().where(UserCanvas.user_id == tenant_id),
                Memory.select().where(Memory.tenant_id == tenant_id),
                Connector.select().where(Connector.tenant_id == tenant_id),
                MCPServer.select().where(MCPServer.tenant_id == tenant_id),
                CompilationTemplateGroup.select().where(
                    (CompilationTemplateGroup.tenant_id == tenant_id)
                    & (CompilationTemplateGroup.status == StatusEnum.VALID.value)
                ),
                team_files,
            )
            if any(query.exists() for query in resource_queries):
                raise ValueError("Delete all team resources before deleting the team.")
            with DB.atomic():
                file_ids = [file_id for (file_id,) in File.select(File.id).where(File.tenant_id == tenant_id).tuples()]
                knowledgebase_ids = [
                    knowledgebase_id
                    for (knowledgebase_id,) in Knowledgebase.select(Knowledgebase.id).where(Knowledgebase.tenant_id == tenant_id).tuples()
                ]
                commit_ids = [
                    commit_id
                    for (commit_id,) in FileCommit.select(FileCommit.id).where(FileCommit.folder_id.in_(file_ids + knowledgebase_ids)).tuples()
                ]
                provider_ids = [
                    provider_id
                    for (provider_id,) in TenantModelProvider.select(TenantModelProvider.id).where(TenantModelProvider.tenant_id == tenant_id).tuples()
                ]
                instance_ids = [
                    instance_id
                    for (instance_id,) in TenantModelInstance.select(TenantModelInstance.id).where(TenantModelInstance.provider_id.in_(provider_ids)).tuples()
                ]
                model_ids = [
                    model_id
                    for (model_id,) in TenantModel.select(TenantModel.id).where(TenantModel.provider_id.in_(provider_ids)).tuples()
                ]

                FileCommitItem.delete().where(FileCommitItem.commit_id.in_(commit_ids)).execute()
                FileCommit.delete().where(FileCommit.id.in_(commit_ids)).execute()
                File2Document.delete().where(File2Document.file_id.in_(file_ids)).execute()
                File.delete().where(File.tenant_id == tenant_id).execute()
                APIToken.delete().where(APIToken.tenant_id == tenant_id).execute()
                TenantLLM.delete().where(TenantLLM.tenant_id == tenant_id).execute()
                TenantModelGroupMapping.delete().where(
                    (TenantModelGroupMapping.provider_id.in_(provider_ids))
                    | (TenantModelGroupMapping.instance_id.in_(instance_ids))
                    | (TenantModelGroupMapping.model_id.in_(model_ids))
                ).execute()
                TenantModel.delete().where(TenantModel.provider_id.in_(provider_ids)).execute()
                TenantModelInstance.delete().where(TenantModelInstance.provider_id.in_(provider_ids)).execute()
                TenantModelProvider.delete().where(TenantModelProvider.tenant_id == tenant_id).execute()
                CompilationTemplate.delete().where(CompilationTemplate.tenant_id == tenant_id).execute()
                CompilationTemplateGroup.delete().where(CompilationTemplateGroup.tenant_id == tenant_id).execute()
                UserTenant.update(status=StatusEnum.INVALID.value).where(UserTenant.tenant_id == tenant_id).execute()
                Tenant.update(status=StatusEnum.INVALID.value).where(Tenant.id == tenant_id).execute()
            from api.db.services.resource_quota_service import ResourceQuotaService

            ResourceQuotaService.remove_workspace_quota(tenant_id)
