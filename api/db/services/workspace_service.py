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
from typing import Any

from api.db import TenantPermission, UserTenantRole, WorkspaceType
from api.db.services.user_service import TenantService, UserService, UserTenantService
from common.constants import StatusEnum


class WorkspaceAccessService:
    ACTIVE_MEMBER_ROLES = frozenset({UserTenantRole.OWNER, UserTenantRole.ADMIN, UserTenantRole.NORMAL})
    MANAGER_ROLES = frozenset({UserTenantRole.OWNER, UserTenantRole.ADMIN})

    @staticmethod
    def _value(record: Mapping[str, Any] | Any, field: str, default=None):
        if isinstance(record, Mapping):
            return record.get(field, default)
        return getattr(record, field, default)

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
        if cls.get_workspace_type(tenant_id) != WorkspaceType.TEAM:
            return False
        membership = cls.get_membership(user_id, tenant_id)
        return bool(membership and cls._value(membership, "role") in cls.MANAGER_ROLES)

    @classmethod
    def can_create_knowledgebase(cls, user_id: str, tenant_id: str) -> bool:
        workspace_type = cls.get_workspace_type(tenant_id)
        if workspace_type == WorkspaceType.PERSONAL:
            return tenant_id == user_id and cls.is_member(user_id, tenant_id)
        if workspace_type == WorkspaceType.TEAM:
            return cls.is_member(user_id, tenant_id)
        return False

    @classmethod
    def can_read_knowledgebase(cls, user_id: str, knowledgebase: Mapping[str, Any] | Any) -> bool:
        if cls._value(knowledgebase, "status") != StatusEnum.VALID.value:
            return False

        tenant_id = cls._value(knowledgebase, "tenant_id")
        workspace_type = cls.get_workspace_type(tenant_id)
        permission = cls._value(knowledgebase, "permission")

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
        if cls.get_workspace_type(tenant_id) == WorkspaceType.PERSONAL:
            return True

        membership = cls.get_membership(user_id, tenant_id)
        role = cls._value(membership, "role") if membership else None
        return role in cls.MANAGER_ROLES or cls._value(knowledgebase, "created_by") == user_id

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
        return {
            "read": bool(is_member),
            "create_knowledgebase": cls.can_create_knowledgebase(user_id, tenant_id),
            "manage_members": bool(is_team and role in cls.MANAGER_ROLES),
            "update": bool(is_team and role in cls.MANAGER_ROLES),
            "delete": bool(is_team and role == UserTenantRole.OWNER),
        }

    @classmethod
    def get_knowledgebase_capabilities(cls, user_id: str, knowledgebase: Mapping[str, Any] | Any) -> dict[str, bool]:
        return {
            "read": cls.can_read_knowledgebase(user_id, knowledgebase),
            "update": cls.can_update_knowledgebase(user_id, knowledgebase),
            "delete": cls.can_delete_knowledgebase(user_id, knowledgebase),
        }
