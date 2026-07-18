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
from typing import Any

from quart import g, has_request_context

from api.db import TenantPermission, UserTenantRole, WorkspaceType
from api.db.db_models import (
    DB,
    Dialog,
    Knowledgebase,
    Memory,
    Search,
    Tenant,
    TenantLLM,
    TenantModel,
    TenantModelInstance,
    TenantModelProvider,
    UserCanvas,
    UserTenant,
)
from api.db.services.user_service import TenantService, UserService, UserTenantService
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
    TENANT_CONFIG_FIELDS = (
        "public_key",
        "llm_id",
        "tenant_llm_id",
        "embd_id",
        "tenant_embd_id",
        "asr_id",
        "tenant_asr_id",
        "img2txt_id",
        "tenant_img2txt_id",
        "rerank_id",
        "tenant_rerank_id",
        "tts_id",
        "tenant_tts_id",
        "ocr_id",
        "tenant_ocr_id",
        "parser_ids",
    )

    @staticmethod
    def _lock_name(operation: str, *identifiers: str) -> str:
        digest = hashlib.sha256(":".join(identifiers).encode()).hexdigest()[:48]
        return f"team:{operation}:{digest}"

    @classmethod
    def create(cls, owner_id: str, name: str) -> dict[str, Any]:
        name = str(name or "").strip()
        if not name or len(name) > 100:
            raise ValueError("Team name must contain between 1 and 100 characters.")
        personal_membership = TenantService.get_personal_by_user_id(owner_id)
        exists, personal = TenantService.get_by_id(owner_id)
        if not personal_membership or not exists:
            raise LookupError("Personal workspace not found.")
        tenant_id = get_uuid()
        with DB.atomic():
            model_id_map = cls._copy_model_config(owner_id, tenant_id)
            payload = {field: getattr(personal, field, None) for field in cls.TENANT_CONFIG_FIELDS}
            for field in ("tenant_llm_id", "tenant_embd_id", "tenant_asr_id", "tenant_img2txt_id", "tenant_rerank_id", "tenant_tts_id", "tenant_ocr_id"):
                if payload.get(field) in model_id_map:
                    payload[field] = model_id_map[payload[field]]
            payload.update({"id": tenant_id, "name": name, "status": StatusEnum.VALID.value})
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

    @staticmethod
    def _copy_model_config(source_tenant_id: str, target_tenant_id: str) -> dict[str, str]:
        for source in TenantLLM.select().where(TenantLLM.tenant_id == source_tenant_id):
            data = source.to_dict()
            data["tenant_id"] = target_tenant_id
            TenantLLM.insert(**data).execute()

        model_id_map: dict[str, str] = {}
        providers = list(TenantModelProvider.select().where(TenantModelProvider.tenant_id == source_tenant_id))
        for source_provider in providers:
            provider_id = get_uuid()
            TenantModelProvider.insert(id=provider_id, provider_name=source_provider.provider_name, tenant_id=target_tenant_id).execute()
            instances = list(TenantModelInstance.select().where(TenantModelInstance.provider_id == source_provider.id))
            for source_instance in instances:
                models = list(TenantModel.select().where(TenantModel.instance_id == source_instance.id))
                instance_id = get_uuid()
                instance_data = source_instance.to_dict()
                instance_data.update({"id": instance_id, "provider_id": provider_id})
                TenantModelInstance.insert(**instance_data).execute()
                for source_model in models:
                    model_id = get_uuid()
                    model_data = source_model.to_dict()
                    model_data.update({"id": model_id, "provider_id": provider_id, "instance_id": instance_id})
                    TenantModel.insert(**model_data).execute()
                    model_id_map[source_model.id] = model_id
        return model_id_map

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
        membership = WorkspaceAccessService.get_membership(actor_id, tenant_id)
        if not WorkspaceAccessService.is_superuser(actor_id) and (not membership or membership.role != UserTenantRole.OWNER):
            raise PermissionError("Only the owner can delete a team.")
        resource_queries = (
            Knowledgebase.select().where((Knowledgebase.tenant_id == tenant_id) & (Knowledgebase.status == StatusEnum.VALID.value)),
            Dialog.select().where((Dialog.tenant_id == tenant_id) & (Dialog.status == StatusEnum.VALID.value)),
            Search.select().where((Search.tenant_id == tenant_id) & (Search.status == StatusEnum.VALID.value)),
            UserCanvas.select().where(UserCanvas.user_id == tenant_id),
            Memory.select().where(Memory.tenant_id == tenant_id),
        )
        if any(query.exists() for query in resource_queries):
            raise ValueError("Delete all team resources before deleting the team.")
        with DB.atomic():
            UserTenant.update(status=StatusEnum.INVALID.value).where(UserTenant.tenant_id == tenant_id).execute()
            Tenant.update(status=StatusEnum.INVALID.value).where(Tenant.id == tenant_id).execute()
