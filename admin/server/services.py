#
#  Copyright 2025 The InfiniFlow Authors. All Rights Reserved.
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

import base64
import binascii
import json
import logging
import os
import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any

from peewee import Case, fn

from common.constants import ActiveEnum, ActiveStatusEnum, StatusEnum
from api.db import (
    KNOWLEDGEBASE_FOLDER_NAME,
    SKILLS_FOLDER_NAME,
    CanvasCategory,
    FileType,
    TenantPermission,
    UserTenantRole,
    WorkspaceType,
)
from api.db.services import UserService, generate_access_token
from api.db.joint_services.user_account_service import create_new_user, delete_user_data
from api.db.services.canvas_service import UserCanvasService
from api.db.services.user_service import TenantService, UserTenantService
from api.db.services.workspace_service import TeamService, WorkspaceAccessService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.system_settings_service import SystemSettingsService
from api.db.services.api_service import APITokenService
from api.db.db_models import (
    API4Conversation,
    APIToken,
    Conversation,
    DB,
    Dialog,
    Document,
    File,
    File2Document,
    Knowledgebase,
    Memory,
    Search,
    Task,
    Tenant,
    TenantModelInstance,
    TenantModelProvider,
    User,
    UserCanvas,
    UserTenant,
)
from api.utils.crypt import check_password_hash, decrypt
from api.utils.model_utils import calculate_model_type, get_model_type_human
from api.utils import health_utils
from api.db.services.resource_reference_service import ResourceReferenceService
from api.db.services.resource_quota_service import ResourceQuotaService
from api.db.services.shared_model_service import SharedModelService
from api.db.services.tenant_model_instance_service import TenantModelInstanceService
from api.db.services.tenant_model_provider_service import TenantModelProviderService
from api.db.services.tenant_model_service import TenantModelService

from api.common.exceptions import AdminException, UserAlreadyExistsError, UserNotFoundError
from config import SERVICE_CONFIGS


class OrganizationMgr:
    SETTING_NAME = "admin.organization"

    @classmethod
    def _load(cls):
        settings = SystemSettingsService.get_by_name(cls.SETTING_NAME)
        if not settings:
            return {"departments": [], "user_departments": {}, "user_metadata": {}}
        try:
            data = json.loads(settings[0].value)
        except (TypeError, json.JSONDecodeError):
            data = {}
        return {
            "departments": data.get("departments", []),
            "user_departments": data.get("user_departments", {}),
            "user_metadata": data.get("user_metadata", {}),
        }

    @classmethod
    def _save(cls, data):
        value = json.dumps(data, ensure_ascii=False)
        settings = SystemSettingsService.get_by_name(cls.SETTING_NAME)
        if settings:
            setting = settings[0].to_dict()
            setting["value"] = value
            SystemSettingsService.update_by_name(cls.SETTING_NAME, setting)
        else:
            SystemSettingsService.save(
                name=cls.SETTING_NAME,
                source="admin",
                data_type="json",
                value=value,
            )

    @staticmethod
    def _department_map(data):
        return {department["id"]: department for department in data["departments"]}

    @classmethod
    def _build_path(cls, data, name, parent_id):
        if not parent_id:
            return name
        parent = cls._department_map(data).get(parent_id)
        if not parent:
            raise AdminException("Parent department not found", 404)
        return f'{parent["path"]}/{name}'

    @classmethod
    def list_departments(cls, query=""):
        data = cls._load()
        user_counts = {}
        for department_id in data["user_departments"].values():
            user_counts[department_id] = user_counts.get(department_id, 0) + 1
        departments = [
            {**department, "user_count": user_counts.get(department["id"], 0)}
            for department in data["departments"]
        ]
        query = str(query or "").strip().casefold()
        if query:
            departments = [
                department for department in departments if query in str(department.get("name", "")).casefold()
            ]
        return sorted(departments, key=lambda department: department["path"])

    @classmethod
    def ensure_department_exists(cls, department_id):
        if department_id not in cls._department_map(cls._load()):
            raise AdminException("Department not found", 404)

    @classmethod
    def create_department(cls, name, parent_id=None):
        data = cls._load()
        name = str(name or "").strip()
        if not name:
            raise AdminException("Department name is required", 400)
        now = datetime.now(timezone.utc).isoformat()
        department = {
            "id": uuid.uuid4().hex,
            "name": name,
            "parent_id": parent_id or None,
            "path": cls._build_path(data, name, parent_id),
            "created_at": now,
            "updated_at": now,
        }
        data["departments"].append(department)
        cls._save(data)
        return department

    @classmethod
    def update_department(cls, department_id, name, parent_id=None):
        data = cls._load()
        departments = cls._department_map(data)
        department = departments.get(department_id)
        if not department:
            raise AdminException("Department not found", 404)
        if parent_id == department_id:
            raise AdminException("Department cannot be its own parent", 400)
        if parent_id:
            ancestor = departments.get(parent_id)
            while ancestor:
                if ancestor["id"] == department_id:
                    raise AdminException("Department cannot be moved below its child", 400)
                ancestor = departments.get(ancestor.get("parent_id"))
        old_path = department["path"]
        department["name"] = str(name or department["name"]).strip()
        department["parent_id"] = parent_id or None
        department["path"] = cls._build_path(data, department["name"], parent_id)
        department["updated_at"] = datetime.now(timezone.utc).isoformat()
        for child in data["departments"]:
            if child["path"].startswith(f"{old_path}/"):
                child["path"] = f'{department["path"]}{child["path"][len(old_path):]}'
        cls._save(data)
        return department

    @classmethod
    def delete_department(cls, department_id):
        data = cls._load()
        if department_id not in cls._department_map(data):
            raise AdminException("Department not found", 404)
        if any(department.get("parent_id") == department_id for department in data["departments"]):
            raise AdminException("Department still has child departments", 409)
        if department_id in data["user_departments"].values():
            raise AdminException("Department still has users", 409)
        data["departments"] = [department for department in data["departments"] if department["id"] != department_id]
        cls._save(data)
        return True

    @classmethod
    def set_user_department(cls, user_id, department_id=None):
        data = cls._load()
        if department_id and department_id not in cls._department_map(data):
            raise AdminException("Department not found", 404)
        if department_id:
            data["user_departments"][user_id] = department_id
        else:
            data["user_departments"].pop(user_id, None)
        cls._save(data)

    @classmethod
    def set_user_department_by_email(cls, email, department_id=None):
        users = UserService.query_user_by_email(email)
        if not users:
            raise UserNotFoundError(email)
        cls.set_user_department(users[0].id, department_id)

    @classmethod
    def get_user_departments(cls):
        data = cls._load()
        departments = cls._department_map(data)
        return {
            user_id: {
                "department_id": department_id,
                "department_path": departments.get(department_id, {}).get("path", ""),
            }
            for user_id, department_id in data["user_departments"].items()
        }

    @classmethod
    def get_user_metadata(cls, user_id):
        return cls._load()["user_metadata"].get(user_id, {})

    @classmethod
    def set_user_metadata(cls, user_id, metadata):
        data = cls._load()
        cleaned = {key: value for key, value in metadata.items() if value not in (None, "")}
        if cleaned:
            data["user_metadata"][user_id] = cleaned
        else:
            data["user_metadata"].pop(user_id, None)
        cls._save(data)

    @classmethod
    def remove_user(cls, user_id):
        data = cls._load()
        data["user_departments"].pop(user_id, None)
        data["user_metadata"].pop(user_id, None)
        cls._save(data)


class UserMgr:
    @staticmethod
    def get_all_users():
        users = UserService.get_all_users()
        usage_by_user = UserMgr.get_user_usage([user.id for user in users])
        departments_by_user = OrganizationMgr.get_user_departments()
        result = []
        for user in users:
            result.append(
                {
                    "id": user.id,
                    "email": user.email,
                    "nickname": user.nickname,
                    "create_date": user.create_date,
                    "last_login_time": user.last_login_time,
                    "is_active": user.is_active,
                    "is_superuser": user.is_superuser,
                    "password_plain": UserMgr.get_plain_password(user.password),
                    **departments_by_user.get(user.id, {"department_id": None, "department_path": ""}),
                    **usage_by_user[user.id],
                }
            )
        return result

    @staticmethod
    def get_plain_password(password):
        prefix = "{noop}"
        password = str(password or "")
        if not password.startswith(prefix):
            return ""
        encoded = password[len(prefix) :]
        try:
            return base64.b64decode(encoded, validate=True).decode("utf-8")
        except (binascii.Error, ValueError, UnicodeDecodeError):
            return encoded

    @staticmethod
    def get_user_login_url(username):
        users = UserService.query_user_by_email(username)
        if not users:
            raise UserNotFoundError(username)
        user = users[0]
        if user.is_active == ActiveEnum.INACTIVE.value:
            raise AdminException("User is inactive", 409)
        user.access_token = generate_access_token(user.id)
        user.save()
        return {"url": f"/?auth={user.get_id()}", "email": user.email}

    @staticmethod
    def get_user_usage(user_ids):
        if not user_ids:
            return {}

        valid = StatusEnum.VALID.value
        team_counts = {user_id: 0 for user_id in user_ids}
        for membership in UserTenant.select(UserTenant.user_id, UserTenant.tenant_id).where(
            (UserTenant.user_id.in_(user_ids)) & (UserTenant.status == valid)
        ):
            if membership.tenant_id != membership.user_id:
                team_counts[membership.user_id] += 1

        dataset_usage = {
            row["user_id"]: int(row["created_datasets"] or 0)
            for row in (
                Knowledgebase.select(
                    Knowledgebase.created_by.alias("user_id"),
                    fn.COUNT(Knowledgebase.id).alias("created_datasets"),
                )
                .where((Knowledgebase.created_by.in_(user_ids)) & (Knowledgebase.status == valid))
                .group_by(Knowledgebase.created_by)
                .dicts()
            )
        }
        document_usage = {
            row["user_id"]: row
            for row in (
                Document.select(
                    Document.created_by.alias("user_id"),
                    fn.COUNT(Document.id).alias("uploaded_documents"),
                    fn.COALESCE(
                        fn.SUM(
                            Case(
                                None,
                                [(Knowledgebase.tenant_id == Document.created_by, Document.size)],
                                0,
                            )
                        ),
                        0,
                    ).alias("uploaded_storage_bytes"),
                )
                .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
                .join(Tenant, on=(Knowledgebase.tenant_id == Tenant.id))
                .where(
                    (Document.created_by.in_(user_ids))
                    & (Document.status == valid)
                    & (Knowledgebase.status == valid)
                    & (Tenant.status == valid)
                )
                .group_by(Document.created_by)
                .dicts()
            )
        }

        return {
            user_id: {
                "teams_total": team_counts[user_id],
                "created_datasets": dataset_usage.get(user_id, 0),
                "uploaded_documents": int(document_usage.get(user_id, {}).get("uploaded_documents", 0) or 0),
                "uploaded_storage_bytes": int(document_usage.get(user_id, {}).get("uploaded_storage_bytes", 0) or 0),
            }
            for user_id in user_ids
        }

    @staticmethod
    def get_user_details(username):
        # use email to query
        users = UserService.query_user_by_email(username)
        result = []
        departments = OrganizationMgr.get_user_departments()
        for user in users:
            result.append(
                {
                    "id": user.id,
                    "avatar": user.avatar,
                    "email": user.email,
                    "nickname": user.nickname,
                    "password_plain": UserMgr.get_plain_password(user.password),
                    "language": user.language,
                    "last_login_time": user.last_login_time,
                    "is_active": user.is_active,
                    "is_anonymous": user.is_anonymous,
                    "login_channel": user.login_channel,
                    "status": user.status,
                    "is_superuser": user.is_superuser,
                    "create_date": user.create_date,
                    "update_date": user.update_date,
                    **departments.get(user.id, {"department_id": None, "department_path": ""}),
                    "remark": OrganizationMgr.get_user_metadata(user.id).get("remark", ""),
                    "quota": ResourceQuotaService.get_workspace_quota(user.id),
                }
            )
        return result

    @staticmethod
    def update_user_quota(username, data):
        users = UserService.query_user_by_email(username)
        if not users:
            raise UserNotFoundError(username)
        return ResourceQuotaService.set_workspace_quota(users[0].id, data)

    @staticmethod
    def update_user_profile(username, data):
        users = UserService.query_user_by_email(username)
        if not users:
            raise UserNotFoundError(username)
        if len(users) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        user = users[0]

        if "email" in data:
            raise AdminException("Email cannot be changed", 400)

        department_id = data.get("department_id")
        if department_id:
            OrganizationMgr.ensure_department_exists(department_id)
        password = decrypt(data["password"]) if data.get("password") else None
        remark = str(data.get("remark") or "").strip()
        if len(remark) > 2000:
            raise AdminException("Remark must be at most 2000 characters", 400)

        updates = {}
        if "nickname" in data:
            nickname = str(data.get("nickname") or "").strip()
            if len(nickname) > 100:
                raise AdminException("Nickname must be at most 100 characters", 400)
            updates["nickname"] = nickname
        if "is_active" in data:
            updates["is_active"] = ActiveEnum.ACTIVE.value if data["is_active"] else ActiveEnum.INACTIVE.value
        if "is_superuser" in data:
            updates["is_superuser"] = bool(data["is_superuser"])
        UserService.update_user(user.id, updates)

        if password is not None:
            UserService.update_user_password(user.id, password)
        if "department_id" in data:
            OrganizationMgr.set_user_department(user.id, department_id)
        if "remark" in data:
            OrganizationMgr.set_user_metadata(user.id, {"remark": remark})

        refreshed = UserService.filter_by_id(user.id)
        return {"email": refreshed.email, "id": refreshed.id}

    @staticmethod
    def create_user(username, password, role="user") -> dict:
        # Validate the email address
        if not re.match(r"^[\w\._-]+@([\w_-]+\.)+[\w-]{2,}$", username):
            raise AdminException(f"Invalid email address: {username}!")
        # Check if the email address is already used
        if UserService.query(email=username):
            raise UserAlreadyExistsError(username)
        # Construct user info data
        user_info_dict = {
            "email": username,
            "nickname": "",  # ask user to edit it manually in settings.
            "password": decrypt(password),
            "login_channel": "password",
            "is_superuser": role == "admin",
        }
        return create_new_user(user_info_dict)

    @staticmethod
    def delete_user(username):
        # use email to delete
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        if len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        usr = user_list[0]
        result = delete_user_data(usr.id)
        if result.get("success"):
            OrganizationMgr.remove_user(usr.id)
            ResourceQuotaService.remove_workspace_quota(usr.id)
        return result

    @staticmethod
    def update_user_password(username, new_password) -> str:
        # use email to find user. check exist and unique.
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        # check new_password different from old.
        usr = user_list[0]
        psw = decrypt(new_password)
        # SSO-provisioned users (OIDC/OAuth) have no local password (usr.password is None):
        # skip the equality check, which would otherwise crash inside werkzeug's split().
        if usr.password and check_password_hash(usr.password, psw):
            return "Same password, no need to update!"
        # update password
        UserService.update_user_password(usr.id, psw)
        return "Password updated successfully!"

    @staticmethod
    def update_user_activate_status(username, activate_status: str):
        # use email to find user. check exist and unique.
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        # check activate status different from new
        usr = user_list[0]
        # format activate_status before handle
        _activate_status = activate_status.lower()
        target_status = {
            "on": ActiveEnum.ACTIVE.value,
            "off": ActiveEnum.INACTIVE.value,
        }.get(_activate_status)
        if not target_status:
            raise AdminException(f"Invalid activate_status: {activate_status}")
        if target_status == usr.is_active:
            return f"User activate status is already {_activate_status}!"
        # update is_active
        UserService.update_user(usr.id, {"is_active": target_status})
        return f"Turn {_activate_status} user activate status successfully!"

    @staticmethod
    def get_user_api_key(username: str) -> list[dict[str, Any]]:
        # use email to find user. check exist and unique.
        user_list: list[Any] = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"More than one user with username '{username}' found!")

        usr: Any = user_list[0]
        # tenant_id is typically the same as user_id for the owner tenant
        tenant_id: str = usr.id

        # Query all API keys for this tenant
        api_keys: Any = APITokenService.query(tenant_id=tenant_id)

        result: list[dict[str, Any]] = []
        for key in api_keys:
            result.append(key.to_dict())

        return result

    @staticmethod
    def save_api_key(api_key: dict[str, Any]) -> bool:
        return APITokenService.save(**api_key)

    @staticmethod
    def delete_api_key(username: str, key: str) -> bool:
        # use email to find user. check exist and unique.
        user_list: list[Any] = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")

        usr: Any = user_list[0]
        # tenant_id is typically the same as user_id for the owner tenant
        tenant_id: str = usr.id

        # Delete the API key
        deleted_count: int = APITokenService.filter_delete([APIToken.tenant_id == tenant_id, APIToken.token == key])
        return deleted_count > 0

    @staticmethod
    def grant_admin(username: str):
        # use email to find user. check exist and unique.
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")

        # check activate status different from new
        usr = user_list[0]
        if usr.is_superuser:
            return f"{usr} is already superuser!"
        # update is_active
        UserService.update_user(usr.id, {"is_superuser": True})
        return "Grant successfully!"

    @staticmethod
    def revoke_admin(username: str):
        # use email to find user. check exist and unique.
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        # check activate status different from new
        usr = user_list[0]
        if not usr.is_superuser:
            return f"{usr} isn't superuser, yet!"
        # update is_active
        UserService.update_user(usr.id, {"is_superuser": False})
        return "Revoke successfully!"


def _get_workspace_model_configuration(workspace_id: str) -> dict[str, Any]:
    tenant = Tenant.get_or_none(
        (Tenant.id == workspace_id) & (Tenant.status == StatusEnum.VALID.value)
    )
    default_fields = [
        ("chat", "llm_id", "tenant_llm_id"),
        ("embedding", "embd_id", "tenant_embd_id"),
        ("asr", "asr_id", "tenant_asr_id"),
        ("vision", "img2txt_id", "tenant_img2txt_id"),
        ("rerank", "rerank_id", "tenant_rerank_id"),
        ("tts", "tts_id", "tenant_tts_id"),
        ("ocr", "ocr_id", "tenant_ocr_id"),
    ]
    defaults = [
        {
            "model_type": model_type,
            "model_name": getattr(tenant, name_field, "") or "",
            "model_id": getattr(tenant, id_field, "") or "",
        }
        for model_type, name_field, id_field in default_fields
    ]
    if not tenant:
        return {"defaults": defaults, "models": []}

    providers = TenantModelProviderService.get_by_tenant_id(workspace_id)
    if not providers:
        return {"defaults": defaults, "models": []}
    provider_by_id = {provider.id: provider for provider in providers}
    instances = TenantModelInstanceService.get_by_provider_ids(list(provider_by_id))
    instance_by_id = {instance.id: instance for instance in instances}
    models = TenantModelService.get_models_by_provider_ids_and_instance_ids(
        list(provider_by_id),
        list(instance_by_id),
    )
    managed_model_ids = set(SharedModelService.list_entries())
    rows = []
    for model in models:
        if model.id in managed_model_ids:
            continue
        provider = provider_by_id.get(model.provider_id)
        instance = instance_by_id.get(model.instance_id)
        if not provider or not instance:
            continue
        try:
            instance_extra = json.loads(instance.extra or "{}")
        except (TypeError, json.JSONDecodeError):
            instance_extra = {}
        try:
            model_extra = json.loads(model.extra or "{}")
        except (TypeError, json.JSONDecodeError):
            model_extra = {}
        rows.append(
            {
                "id": model.id,
                "name": model.model_name or "",
                "provider_name": provider.provider_name,
                "instance_name": instance.instance_name,
                "api_key": instance.api_key,
                "base_url": instance_extra.get("base_url", "") if isinstance(instance_extra, dict) else "",
                "model_types": get_model_type_human(model.model_type),
                "max_tokens": int(model_extra.get("max_tokens") or 8192)
                if isinstance(model_extra, dict)
                else 8192,
                "status": model.status,
                "create_date": model.create_date,
                "update_date": model.update_date,
            }
        )
    return {
        "defaults": defaults,
        "models": sorted(
            rows,
            key=lambda row: (
                row["provider_name"],
                row["instance_name"],
                row["name"],
            ),
        ),
    }


class TeamMgr:
    MEMBER_ROLES = {UserTenantRole.OWNER, UserTenantRole.ADMIN, UserTenantRole.NORMAL}
    EDITABLE_ROLES = {UserTenantRole.OWNER, UserTenantRole.ADMIN, UserTenantRole.NORMAL}

    @staticmethod
    def _ensure_team(team_id):
        if WorkspaceAccessService.get_workspace_type(team_id) != WorkspaceType.TEAM:
            raise AdminException("Team not found", 404)

    @staticmethod
    def _owner_id(team_id):
        owner = UserTenant.select().where((UserTenant.tenant_id == team_id) & (UserTenant.role == UserTenantRole.OWNER) & (UserTenant.status == StatusEnum.VALID.value)).first()
        if not owner:
            raise AdminException("Team owner not found", 409)
        return owner.user_id

    @classmethod
    def _members(cls, team_id):
        cls._ensure_team(team_id)
        return TeamService.list_members(cls._owner_id(team_id), team_id)

    @classmethod
    def get_all_teams(cls):
        teams = []
        tenants = Tenant.select().where(Tenant.status == StatusEnum.VALID.value).order_by(Tenant.name)
        for tenant in tenants:
            if WorkspaceAccessService.get_workspace_type(tenant.id) != WorkspaceType.TEAM:
                continue
            members = cls._members(tenant.id)
            owner = next((member for member in members if member["role"] == UserTenantRole.OWNER), {})
            dataset_query = Knowledgebase.select().where(
                (Knowledgebase.tenant_id == tenant.id) & (Knowledgebase.permission == TenantPermission.TEAM) & (Knowledgebase.status == StatusEnum.VALID.value)
            )
            document_stats = (
                Document.select(
                    fn.COUNT(Document.id).alias("document_count"),
                    fn.COALESCE(fn.SUM(Document.size), 0).alias("storage_bytes"),
                )
                .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
                .where(
                    (Knowledgebase.tenant_id == tenant.id)
                    & (Knowledgebase.permission == TenantPermission.TEAM)
                    & (Knowledgebase.status == StatusEnum.VALID.value)
                    & (Document.status == StatusEnum.VALID.value)
                )
                .dicts()
                .first()
                or {}
            )
            teams.append(
                {
                    "id": tenant.id,
                    "name": tenant.name,
                    "owner_id": owner.get("user_id", ""),
                    "owner_email": owner.get("email", ""),
                    "owner_name": owner.get("nickname", ""),
                    "member_count": sum(member["role"] in cls.MEMBER_ROLES for member in members),
                    "invite_count": sum(member["role"] == UserTenantRole.INVITE for member in members),
                    "dataset_count": dataset_query.count(),
                    "document_count": int(document_stats.get("document_count", 0) or 0),
                    "storage_bytes": int(document_stats.get("storage_bytes", 0) or 0),
                    "quota": ResourceQuotaService.get_workspace_quota(tenant.id),
                    "create_date": tenant.create_date,
                    "update_date": tenant.update_date,
                }
            )
        return teams

    @classmethod
    def update_quota(cls, team_id, data):
        cls._ensure_team(team_id)
        return ResourceQuotaService.set_workspace_quota(team_id, data)

    @classmethod
    def create_team(cls, owner_id, name):
        exists, user = UserService.get_by_id(owner_id)
        if not exists or user.status != StatusEnum.VALID.value:
            raise AdminException("Owner not found", 404)
        try:
            return TeamService.create(owner_id, name)
        except (LookupError, PermissionError, ValueError) as exc:
            raise AdminException(str(exc), 400) from exc

    @classmethod
    def update_team(cls, team_id, name, owner_id=None):
        cls._ensure_team(team_id)
        current_owner_id = cls._owner_id(team_id)
        try:
            with DB.atomic():
                team = TeamService.update(current_owner_id, team_id, name)
                if owner_id and owner_id != current_owner_id:
                    TeamService.transfer_ownership(current_owner_id, team_id, owner_id)
                    team = TeamService.get(owner_id, team_id)
                return team
        except (LookupError, PermissionError, ValueError) as exc:
            raise AdminException(str(exc), 400) from exc

    @classmethod
    def delete_team(cls, team_id):
        cls._ensure_team(team_id)
        try:
            TeamService.delete(cls._owner_id(team_id), team_id)
            ResourceQuotaService.remove_workspace_quota(team_id)
            return True
        except (LookupError, PermissionError, ValueError) as exc:
            raise AdminException(str(exc), 409) from exc

    @classmethod
    def list_members(cls, team_id):
        return cls._members(team_id)

    @classmethod
    def get_resources(cls, team_id):
        cls._ensure_team(team_id)
        resources = {
            resource_type: ResourceMgr.list_resources(
                resource_type,
                page=1,
                page_size=1,
                workspace_ids=[team_id],
                hierarchy=resource_type == "file",
                paginate=False,
            )["resources"]
            for resource_type in ResourceMgr.RESOURCE_SPECS
        }
        resources["model"] = _get_workspace_model_configuration(team_id)
        return resources

    @classmethod
    def add_member(cls, team_id, user_id, role):
        cls._ensure_team(team_id)
        if role not in {UserTenantRole.ADMIN, UserTenantRole.NORMAL}:
            raise AdminException("Role must be admin or normal", 400)
        exists, user = UserService.get_by_id(user_id)
        if not exists or user.status != StatusEnum.VALID.value:
            raise AdminException("User not found", 404)
        membership = WorkspaceAccessService.get_membership(user_id, team_id)
        try:
            if not membership:
                TeamService.invite(cls._owner_id(team_id), team_id, user.email)
            elif membership.role != UserTenantRole.INVITE:
                raise AdminException("User is already a team member", 409)
            TeamService.accept_invitation(user_id, team_id)
            if role == UserTenantRole.ADMIN:
                TeamService.update_member_role(cls._owner_id(team_id), team_id, user_id, role)
            return True
        except AdminException:
            raise
        except (LookupError, PermissionError, ValueError) as exc:
            raise AdminException(str(exc), 400) from exc

    @classmethod
    def update_member(cls, team_id, user_id, role):
        cls._ensure_team(team_id)
        if role not in cls.EDITABLE_ROLES:
            raise AdminException("Invalid team role", 400)
        membership = WorkspaceAccessService.get_membership(user_id, team_id)
        if not membership:
            raise AdminException("Membership not found", 404)
        owner_id = cls._owner_id(team_id)
        try:
            if membership.role == UserTenantRole.INVITE:
                TeamService.accept_invitation(user_id, team_id)
                membership = WorkspaceAccessService.get_membership(user_id, team_id)
            if role == UserTenantRole.OWNER:
                TeamService.transfer_ownership(owner_id, team_id, user_id)
            elif membership.role == UserTenantRole.OWNER:
                raise AdminException("Transfer ownership before changing the owner role", 409)
            else:
                TeamService.update_member_role(cls._owner_id(team_id), team_id, user_id, role)
            return True
        except AdminException:
            raise
        except (LookupError, PermissionError, ValueError) as exc:
            raise AdminException(str(exc), 400) from exc

    @classmethod
    def delete_member(cls, team_id, user_id):
        cls._ensure_team(team_id)
        try:
            TeamService.remove_member(cls._owner_id(team_id), team_id, user_id)
            return True
        except (LookupError, PermissionError, ValueError) as exc:
            raise AdminException(str(exc), 409) from exc


class UserServiceMgr:
    @staticmethod
    def get_user_datasets(username):
        # use email to find user.
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        # find tenants
        usr = user_list[0]
        tenants = TenantService.list_accessible_by_user_id(usr.id)
        tenant_ids = [m["tenant_id"] for m in tenants]
        # filter permitted kb and owned kb
        return KnowledgebaseService.get_all_kb_by_tenant_ids(tenant_ids, usr.id)

    @staticmethod
    def get_user_agents(username):
        # use email to find user.
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        elif len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")
        # find tenants
        usr = user_list[0]
        tenants = TenantService.list_accessible_by_user_id(usr.id)
        tenant_ids = [m["tenant_id"] for m in tenants]
        # filter permitted agents and owned agents
        res = UserCanvasService.get_all_agents_by_tenant_ids(tenant_ids, usr.id)
        return [{"title": r["title"], "permission": r["permission"], "canvas_category": r["canvas_category"].split("_")[0], "avatar": r["avatar"]} for r in res]

    @staticmethod
    def get_user_resources(username):
        user_list = UserService.query_user_by_email(username)
        if not user_list:
            raise UserNotFoundError(username)
        if len(user_list) > 1:
            raise AdminException(f"Exist more than 1 user: {username}!")

        user = user_list[0]
        workspace_ids = [
            membership["tenant_id"]
            for membership in TenantService.list_accessible_by_user_id(user.id)
        ]
        resources = {
            resource_type: ResourceMgr.list_resources(
                resource_type,
                page=1,
                page_size=1,
                workspace_ids=workspace_ids,
                paginate=False,
            )["resources"]
            for resource_type in ResourceMgr.RESOURCE_SPECS
        }
        resources["model"] = _get_workspace_model_configuration(user.id)
        return resources

    @staticmethod
    def get_user_tenants(email: str) -> list[dict[str, Any]]:
        users: list[Any] = UserService.query_user_by_email(email)
        if not users:
            raise UserNotFoundError(email)
        user: Any = users[0]

        tenants: list[dict[str, Any]] = UserTenantService.list_memberships_by_user_id(user.id)
        return tenants


class ResourceMgr:
    """Global resource inventory and lifecycle operations for administrators."""

    RESOURCE_SPECS = {
        "dataset": {
            "model": Knowledgebase,
            "name_field": Knowledgebase.name,
            "workspace_field": Knowledgebase.tenant_id,
            "permission_field": Knowledgebase.permission,
            "creator_field": Knowledgebase.created_by,
        },
        "chat": {
            "model": Dialog,
            "name_field": Dialog.name,
            "workspace_field": Dialog.tenant_id,
        },
        "agent": {
            "model": UserCanvas,
            "name_field": UserCanvas.title,
            "workspace_field": UserCanvas.user_id,
            "permission_field": UserCanvas.permission,
            "extra_filter": UserCanvas.canvas_category == CanvasCategory.Agent.value,
        },
        "search": {
            "model": Search,
            "name_field": Search.name,
            "workspace_field": Search.tenant_id,
            "creator_field": Search.created_by,
        },
        "memory": {
            "model": Memory,
            "name_field": Memory.name,
            "workspace_field": Memory.tenant_id,
            "permission_field": Memory.permissions,
        },
        "file": {
            "model": File,
            "name_field": File.name,
            "workspace_field": File.tenant_id,
            "creator_field": File.created_by,
        },
    }

    @classmethod
    def list_resources(
        cls,
        resource_type: str,
        page: int,
        page_size: int,
        keywords: str = "",
        workspace_ids: list[str] | None = None,
        hierarchy: bool = False,
        paginate: bool = True,
    ) -> dict[str, Any]:
        spec = cls.RESOURCE_SPECS.get(resource_type)
        if not spec:
            raise AdminException(f"Unsupported resource type: {resource_type}")

        model = spec["model"]
        name_field = spec["name_field"]
        workspace_field = spec["workspace_field"]
        permission_field = spec.get("permission_field")
        creator_field = spec.get("creator_field")

        fields = [
            model.id,
            name_field.alias("name"),
            workspace_field.alias("workspace_id"),
            model.create_date,
            model.update_date,
        ]
        if permission_field is not None:
            fields.append(permission_field.alias("permission"))
        if creator_field is not None:
            fields.append(creator_field.alias("creator_id"))
        if resource_type == "dataset":
            fields.extend([Knowledgebase.doc_num, Knowledgebase.chunk_num, Knowledgebase.token_num])
        elif resource_type == "chat":
            fields.append(Dialog.kb_ids)
        elif resource_type == "agent":
            fields.extend([UserCanvas.release, UserCanvas.canvas_type])
        elif resource_type == "search":
            fields.append(Search.search_config)
        elif resource_type == "memory":
            fields.extend([Memory.memory_type, Memory.storage_type, Memory.memory_size])
        elif resource_type == "file":
            fields.extend([File.parent_id, File.size, File.type.alias("file_type"), File.source_type])

        query = model.select(*fields)
        if hasattr(model, "status"):
            query = query.where(model.status == StatusEnum.VALID.value)
        if spec.get("extra_filter") is not None:
            query = query.where(spec["extra_filter"])
        if workspace_ids:
            query = query.where(workspace_field.in_(workspace_ids))
        keywords = str(keywords or "").strip().lower()
        if keywords:
            query = query.where(fn.LOWER(name_field).contains(keywords))

        total = query.count()
        ordered_query = query.order_by(model.create_time.desc())
        if not paginate or (resource_type == "file" and hierarchy):
            rows = list(ordered_query.dicts())
        else:
            rows = list(ordered_query.paginate(page, page_size).dicts())
        cls._attach_ownership(rows)
        if resource_type == "dataset":
            cls._attach_dataset_metrics(rows)
        elif resource_type == "chat":
            cls._attach_chat_metrics(rows)
        elif resource_type == "agent":
            cls._attach_agent_metrics(rows)
        elif resource_type == "search":
            for row in rows:
                config = row.pop("search_config", {}) or {}
                row["dataset_count"] = len(set(config.get("kb_ids") or config.get("dataset_ids") or []))
                row["document_count"] = len(set(config.get("doc_ids") or config.get("document_ids") or []))
        elif resource_type == "file":
            cls._attach_file_metrics(rows)
        for row in rows:
            row["resource_type"] = resource_type
            if not row.get("permission"):
                row["permission"] = (
                    TenantPermission.ME.value if row["workspace_type"] == "personal" else TenantPermission.TEAM.value
                )
            row["deletable"] = not (
                resource_type == "file"
                and (
                    row.get("parent_id") == row["id"]
                    or row.get("name") in {KNOWLEDGEBASE_FOLDER_NAME, SKILLS_FOLDER_NAME}
                    or row.get("source_type") in {"knowledgebase", "skill_space"}
                )
            )

        return {"resources": rows, "total": total}

    @staticmethod
    def _attach_file_metrics(rows):
        """Replace folder sizes with the sum of all descendant file sizes."""
        if not rows:
            return

        rows_by_key = {(row["workspace_id"], row["id"]): row for row in rows}
        children_by_parent = defaultdict(list)
        for row in rows:
            parent_id = row.get("parent_id")
            key = (row["workspace_id"], row["id"])
            parent_key = (row["workspace_id"], parent_id)
            if parent_id and parent_key != key and parent_key in rows_by_key:
                children_by_parent[parent_key].append(key)

        totals = {}

        def calculate_size(key, ancestors):
            if key in totals:
                return totals[key]
            if key in ancestors:
                return 0

            row = rows_by_key[key]
            if row.get("file_type") != FileType.FOLDER.value:
                size = int(row.get("size", 0) or 0)
            else:
                size = sum(
                    calculate_size(child_key, ancestors | {key})
                    for child_key in children_by_parent.get(key, [])
                )
                row["size"] = size
            totals[key] = size
            return size

        for key in rows_by_key:
            calculate_size(key, set())

    @staticmethod
    def _attach_dataset_metrics(rows):
        if not rows:
            return
        dataset_ids = [row["id"] for row in rows]
        metrics = {
            row["dataset_id"]: row
            for row in (
                Document.select(
                    Document.kb_id.alias("dataset_id"),
                    fn.COALESCE(fn.SUM(Document.size), 0).alias("storage_bytes"),
                    fn.COALESCE(fn.SUM(Case(None, [(Document.progress < 0, 1)], 0)), 0).alias("failed_documents"),
                    fn.COALESCE(
                        fn.SUM(Case(None, [((Document.progress >= 0) & (Document.progress < 1), 1)], 0)),
                        0,
                    ).alias("processing_documents"),
                )
                .where((Document.kb_id.in_(dataset_ids)) & (Document.status == StatusEnum.VALID.value))
                .group_by(Document.kb_id)
                .dicts()
            )
        }
        for row in rows:
            metric = metrics.get(row["id"], {})
            row["storage_bytes"] = int(metric.get("storage_bytes", 0) or 0)
            row["failed_documents"] = int(metric.get("failed_documents", 0) or 0)
            row["processing_documents"] = int(metric.get("processing_documents", 0) or 0)

    @staticmethod
    def _attach_chat_metrics(rows):
        if not rows:
            return
        counts = {
            row["dialog_id"]: int(row["session_count"] or 0)
            for row in (
                Conversation.select(
                    Conversation.dialog_id,
                    fn.COUNT(Conversation.id).alias("session_count"),
                )
                .where(Conversation.dialog_id.in_([item["id"] for item in rows]))
                .group_by(Conversation.dialog_id)
                .dicts()
            )
        }
        for row in rows:
            row["session_count"] = counts.get(row["id"], 0)
            row["dataset_count"] = len(set(row.pop("kb_ids", []) or []))

    @staticmethod
    def _attach_agent_metrics(rows):
        if not rows:
            return
        counts = {
            row["dialog_id"]: int(row["session_count"] or 0)
            for row in (
                API4Conversation.select(
                    API4Conversation.dialog_id,
                    fn.COUNT(API4Conversation.id).alias("session_count"),
                )
                .where(API4Conversation.dialog_id.in_([item["id"] for item in rows]))
                .group_by(API4Conversation.dialog_id)
                .dicts()
            )
        }
        for row in rows:
            row["session_count"] = counts.get(row["id"], 0)

    @classmethod
    def get_resource_detail(
        cls,
        resource_type: str,
        resource_id: str,
        page: int = 1,
        page_size: int = 20,
    ) -> dict[str, Any]:
        if resource_type != "dataset":
            return cls._get_standard_resource_detail(resource_type, resource_id)

        valid = StatusEnum.VALID.value
        dataset = (
            Knowledgebase.select(
                Knowledgebase.id,
                Knowledgebase.name,
                Knowledgebase.tenant_id.alias("workspace_id"),
                Knowledgebase.created_by.alias("creator_id"),
                Knowledgebase.permission,
                Knowledgebase.description,
                Knowledgebase.language,
                Knowledgebase.embd_id,
                Knowledgebase.parser_id,
                Knowledgebase.pipeline_id,
                Knowledgebase.parser_config,
                Knowledgebase.pagerank,
                Knowledgebase.similarity_threshold,
                Knowledgebase.vector_similarity_weight,
                Knowledgebase.doc_num,
                Knowledgebase.chunk_num,
                Knowledgebase.token_num,
                Knowledgebase.create_date,
                Knowledgebase.update_date,
            )
            .where(
                (Knowledgebase.id == resource_id)
                & (Knowledgebase.status == valid)
            )
            .dicts()
            .first()
        )
        if not dataset:
            raise AdminException("Resource not found", 404)

        cls._attach_ownership([dataset])
        cls._attach_dataset_metrics([dataset])
        dataset["quota"] = ResourceQuotaService.get_dataset_quota(resource_id)
        dataset["resource_type"] = resource_type
        dataset["deletable"] = True

        documents_query = Document.select(
            Document.id,
            Document.name,
            Document.created_by.alias("creator_id"),
            Document.type.alias("file_type"),
            Document.suffix,
            Document.source_type,
            Document.size,
            Document.parser_id,
            Document.pipeline_id,
            Document.parser_config,
            Document.chunk_num,
            Document.token_num,
            Document.progress,
            Document.progress_msg,
            Document.process_begin_at,
            Document.process_duration,
            Document.run,
            Document.create_date,
            Document.update_date,
        ).where((Document.kb_id == resource_id) & (Document.status == valid))
        document_total = documents_query.count()
        documents = list(
            documents_query.order_by(Document.create_time.desc())
            .paginate(page, page_size)
            .dicts()
        )

        creator_ids = {row.get("creator_id") for row in documents if row.get("creator_id")}
        creators = {
            user.id: user.nickname or user.email
            for user in User.select(User.id, User.nickname, User.email).where(
                (User.id.in_(creator_ids)) & (User.status == valid)
            )
        }
        for document in documents:
            document["creator_name"] = creators.get(document.get("creator_id"), "")
            progress = float(document.get("progress") or 0)
            if progress < 0:
                document["parse_status"] = "failed"
            elif progress >= 1:
                document["parse_status"] = "completed"
            elif document.get("run") == "0" and progress == 0:
                document["parse_status"] = "pending"
            else:
                document["parse_status"] = "processing"

        return {
            "dataset": dataset,
            "documents": documents,
            "document_total": document_total,
        }

    @staticmethod
    def update_dataset_quota(resource_id: str, data: dict) -> dict:
        exists = Knowledgebase.select(Knowledgebase.id).where(
            (Knowledgebase.id == resource_id)
            & (Knowledgebase.status == StatusEnum.VALID.value)
        ).exists()
        if not exists:
            raise AdminException("Resource not found", 404)
        return ResourceQuotaService.set_dataset_quota(resource_id, data)

    @classmethod
    def _get_standard_resource_detail(
        cls, resource_type: str, resource_id: str
    ) -> dict[str, Any]:
        valid = StatusEnum.VALID.value
        configuration: dict[str, Any] = {}
        related_resources: list[dict[str, Any]] = []

        if resource_type == "chat":
            resource = (
                Dialog.select(
                    Dialog.id,
                    Dialog.name,
                    Dialog.tenant_id.alias("workspace_id"),
                    Dialog.description,
                    Dialog.language,
                    Dialog.llm_id,
                    Dialog.prompt_type,
                    Dialog.similarity_threshold,
                    Dialog.vector_similarity_weight,
                    Dialog.top_n,
                    Dialog.top_k,
                    Dialog.do_refer,
                    Dialog.rerank_id,
                    Dialog.kb_ids,
                    Dialog.llm_setting,
                    Dialog.prompt_config,
                    Dialog.meta_data_filter,
                    Dialog.create_date,
                    Dialog.update_date,
                )
                .where((Dialog.id == resource_id) & (Dialog.status == valid))
                .dicts()
                .first()
            )
            if resource:
                resource["session_count"] = Conversation.select().where(
                    Conversation.dialog_id == resource_id
                ).count()
                resource["dataset_count"] = len(set(resource.get("kb_ids") or []))
                configuration = {
                    "model_settings": resource.pop("llm_setting", {}) or {},
                    "prompt": resource.pop("prompt_config", {}) or {},
                    "retrieval": {
                        "similarity_threshold": resource.get("similarity_threshold"),
                        "vector_similarity_weight": resource.get("vector_similarity_weight"),
                        "top_n": resource.get("top_n"),
                        "top_k": resource.get("top_k"),
                        "rerank_id": resource.get("rerank_id"),
                        "do_refer": resource.get("do_refer") == "1",
                    },
                    "metadata_filter": resource.pop("meta_data_filter", {}) or {},
                }
                related_resources = cls._dataset_references(resource.pop("kb_ids", []) or [])
        elif resource_type == "search":
            resource = (
                Search.select(
                    Search.id,
                    Search.name,
                    Search.tenant_id.alias("workspace_id"),
                    Search.created_by.alias("creator_id"),
                    Search.description,
                    Search.search_config,
                    Search.create_date,
                    Search.update_date,
                )
                .where((Search.id == resource_id) & (Search.status == valid))
                .dicts()
                .first()
            )
            if resource:
                search_config = resource.pop("search_config", {}) or {}
                dataset_ids = search_config.get("kb_ids") or search_config.get("dataset_ids") or []
                document_ids = search_config.get("doc_ids") or search_config.get("document_ids") or []
                resource["dataset_count"] = len(set(dataset_ids))
                resource["document_count"] = len(set(document_ids))
                configuration = {"search": search_config}
                related_resources = cls._dataset_references(dataset_ids)
                related_resources.extend(cls._document_references(document_ids))
        elif resource_type == "agent":
            resource = (
                UserCanvas.select(
                    UserCanvas.id,
                    UserCanvas.title.alias("name"),
                    UserCanvas.user_id.alias("workspace_id"),
                    UserCanvas.permission,
                    UserCanvas.release,
                    UserCanvas.description,
                    UserCanvas.canvas_type,
                    UserCanvas.canvas_category,
                    UserCanvas.tags,
                    UserCanvas.dsl,
                    UserCanvas.create_date,
                    UserCanvas.update_date,
                )
                .where(
                    (UserCanvas.id == resource_id)
                    & (UserCanvas.canvas_category == CanvasCategory.Agent.value)
                )
                .dicts()
                .first()
            )
            if resource:
                resource["session_count"] = API4Conversation.select().where(
                    API4Conversation.dialog_id == resource_id
                ).count()
                configuration = {"canvas": resource.pop("dsl", {}) or {}}
        elif resource_type == "memory":
            resource = (
                Memory.select(
                    Memory.id,
                    Memory.name,
                    Memory.tenant_id.alias("workspace_id"),
                    Memory.permissions.alias("permission"),
                    Memory.description,
                    Memory.memory_type,
                    Memory.storage_type,
                    Memory.memory_size,
                    Memory.embd_id,
                    Memory.llm_id,
                    Memory.forgetting_policy,
                    Memory.temperature,
                    Memory.system_prompt,
                    Memory.user_prompt,
                    Memory.create_date,
                    Memory.update_date,
                )
                .where(Memory.id == resource_id)
                .dicts()
                .first()
            )
            if resource:
                configuration = {
                    "extraction": {
                        "temperature": resource.pop("temperature", None),
                        "system_prompt": resource.pop("system_prompt", "") or "",
                        "user_prompt": resource.pop("user_prompt", "") or "",
                    }
                }
        elif resource_type == "file":
            resource = (
                File.select(
                    File.id,
                    File.name,
                    File.tenant_id.alias("workspace_id"),
                    File.created_by.alias("creator_id"),
                    File.parent_id,
                    File.location,
                    File.size,
                    File.type.alias("file_type"),
                    File.source_type,
                    File.create_date,
                    File.update_date,
                )
                .where(File.id == resource_id)
                .dicts()
                .first()
            )
            if resource:
                relations = list(
                    File2Document.select(
                        Document.id,
                        Document.name,
                        Document.kb_id,
                        Knowledgebase.name.alias("dataset_name"),
                    )
                    .join(Document, on=(File2Document.document_id == Document.id))
                    .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
                    .where(File2Document.file_id == resource_id)
                    .dicts()
                )
                related_resources = [
                    {
                        "resource_type": "file",
                        "id": row["id"],
                        "name": row["name"],
                        "detail": row["dataset_name"],
                    }
                    for row in relations
                ]
                configuration = {
                    "storage": {
                        "location": resource.pop("location", "") or "",
                        "parent_id": resource.get("parent_id") or "",
                    }
                }
        else:
            raise AdminException(f"Unsupported resource detail type: {resource_type}", 400)

        if not resource:
            raise AdminException("Resource not found", 404)

        cls._attach_ownership([resource])
        if not resource.get("permission"):
            resource["permission"] = (
                TenantPermission.ME.value
                if resource["workspace_type"] == "personal"
                else TenantPermission.TEAM.value
            )
        resource["resource_type"] = resource_type
        resource["deletable"] = not (
            resource_type == "file"
            and (
                resource.get("parent_id") == resource["id"]
                or resource.get("name") in {KNOWLEDGEBASE_FOLDER_NAME, SKILLS_FOLDER_NAME}
                or resource.get("source_type") in {"knowledgebase", "skill_space"}
            )
        )
        return {
            "resource": resource,
            "configuration": configuration,
            "related_resources": related_resources,
        }

    @staticmethod
    def _dataset_references(dataset_ids: list[str]) -> list[dict[str, Any]]:
        if not dataset_ids:
            return []
        return [
            {
                "resource_type": "dataset",
                "id": row["id"],
                "name": row["name"],
            }
            for row in Knowledgebase.select(Knowledgebase.id, Knowledgebase.name)
            .where(Knowledgebase.id.in_(set(dataset_ids)))
            .dicts()
        ]

    @staticmethod
    def _document_references(document_ids: list[str]) -> list[dict[str, Any]]:
        if not document_ids:
            return []
        return [
            {
                "resource_type": "file",
                "id": row["id"],
                "name": row["name"],
            }
            for row in Document.select(Document.id, Document.name)
            .where(Document.id.in_(set(document_ids)))
            .dicts()
        ]

    @classmethod
    async def delete_resource(
        cls,
        resource_type: str,
        resource_id: str,
        actor_id: str,
        authorization: str = "",
    ) -> dict[str, Any]:
        spec = cls.RESOURCE_SPECS.get(resource_type)
        if not spec:
            raise AdminException(f"Unsupported resource type: {resource_type}")

        model = spec["model"]
        query = model.select().where(model.id == resource_id)
        if hasattr(model, "status"):
            query = query.where(model.status == StatusEnum.VALID.value)
        if spec.get("extra_filter") is not None:
            query = query.where(spec["extra_filter"])
        resource = query.first()
        if not resource:
            raise AdminException("Resource not found", 404)

        if resource_type == "dataset":
            from api.apps.services import dataset_api_service

            success, result = await dataset_api_service.delete_datasets(actor_id, [resource_id])
        elif resource_type == "chat":
            success = bool(Dialog.update(status=StatusEnum.INVALID.value).where(Dialog.id == resource_id).execute())
            result = True if success else "Failed to delete chat"
        elif resource_type == "search":
            from api.db.services.search_service import SearchService

            success = bool(SearchService.delete_by_id(resource_id))
            result = True if success else "Failed to delete search"
        elif resource_type == "agent":
            success = bool(UserCanvasService.delete_with_dependencies(resource_id))
            result = True if success else "Failed to delete agent"
        elif resource_type == "memory":
            from api.apps.services import memory_api_service

            success = bool(await memory_api_service.delete_memory_as_admin(resource_id))
            result = True if success else "Failed to delete memory"
        else:
            if (
                resource.parent_id == resource.id
                or resource.name in {KNOWLEDGEBASE_FOLDER_NAME, SKILLS_FOLDER_NAME}
                or resource.source_type in {"knowledgebase", "skill_space"}
            ):
                raise AdminException(
                    "This file is managed by its source resource and cannot be deleted separately.",
                    409,
                )
            from api.apps.services import file_api_service

            success, result = await file_api_service.delete_files(
                actor_id,
                [resource_id],
                authorization,
                resource.tenant_id,
            )

        if not success:
            raise AdminException(str(result), 409)
        if resource_type == "dataset":
            ResourceQuotaService.remove_dataset_quota(resource_id)
        return {"resource_type": resource_type, "resource_id": resource_id, "result": result}

    @staticmethod
    def list_failed_documents(
        page,
        page_size,
        keywords="",
        workspace_ids: list[str] | None = None,
    ):
        valid = StatusEnum.VALID.value
        query = (
            Document.select(
                Document.id,
                Document.name,
                Document.kb_id.alias("dataset_id"),
                Knowledgebase.name.alias("dataset_name"),
                Knowledgebase.tenant_id.alias("workspace_id"),
                Document.progress_msg.alias("failure_reason"),
                Document.size,
                Document.create_date,
            )
            .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
            .where((Document.status == valid) & (Knowledgebase.status == valid) & (Document.progress < 0))
        )
        if workspace_ids:
            query = query.where(Knowledgebase.tenant_id.in_(workspace_ids))
        keywords = str(keywords or "").strip().lower()
        if keywords:
            query = query.where(
                fn.LOWER(Document.name).contains(keywords)
                | fn.LOWER(Knowledgebase.name).contains(keywords)
                | fn.LOWER(Document.progress_msg).contains(keywords)
            )
        total = query.count()
        rows = list(query.order_by(Document.create_time.desc()).paginate(page, page_size).dicts())
        ResourceMgr._attach_ownership(rows)
        return {"documents": rows, "total": total}

    @staticmethod
    def _attach_ownership(rows: list[dict[str, Any]]) -> None:
        if not rows:
            return

        workspace_ids = {row["workspace_id"] for row in rows}
        creator_ids = {row.get("creator_id") for row in rows if row.get("creator_id")}
        user_ids = workspace_ids | creator_ids

        users = {
            user.id: user
            for user in User.select(User.id, User.nickname, User.email).where(
                (User.id.in_(user_ids)) & (User.status == StatusEnum.VALID.value)
            )
        }
        tenants = {
            tenant.id: tenant.name
            for tenant in Tenant.select(Tenant.id, Tenant.name).where(
                (Tenant.id.in_(workspace_ids)) & (Tenant.status == StatusEnum.VALID.value)
            )
        }

        for row in rows:
            workspace_id = row["workspace_id"]
            personal_owner = users.get(workspace_id)
            if personal_owner:
                row["workspace_type"] = "personal"
                row["workspace_name"] = personal_owner.nickname or personal_owner.email
            else:
                row["workspace_type"] = "team"
                row["workspace_name"] = tenants.get(workspace_id) or workspace_id

            creator = users.get(row.get("creator_id"))
            row["creator_name"] = (creator.nickname or creator.email) if creator else ""


class AdminModelMgr:
    PROVIDERS = {"MinerU", "OpenAI-API-Compatible", "Xinference"}
    MODEL_TYPES = {"chat", "embedding", "asr", "vision", "rerank", "tts", "ocr"}

    @staticmethod
    def _parse_extra(raw: str) -> dict:
        try:
            value = json.loads(raw or "{}")
        except (TypeError, json.JSONDecodeError):
            return {}
        return value if isinstance(value, dict) else {}

    @classmethod
    def _validate_access(cls, visibility: str, workspace_ids: list[str]) -> tuple[str, list[str]]:
        visibility = str(visibility or "all")
        if visibility not in {"all", "selected"}:
            raise AdminException("visibility must be 'all' or 'selected'", 400)
        workspace_ids = sorted({str(workspace_id) for workspace_id in workspace_ids or [] if workspace_id})
        if visibility == "selected":
            existing_ids = {
                tenant.id
                for tenant in Tenant.select(Tenant.id).where(
                    Tenant.id.in_(workspace_ids),
                    Tenant.status == StatusEnum.VALID.value,
                )
            }
            missing = sorted(set(workspace_ids) - existing_ids)
            if missing:
                raise AdminException(f"Workspaces not found: {', '.join(missing)}", 404)
        return visibility, workspace_ids

    @classmethod
    def list_workspaces(cls) -> list[dict[str, Any]]:
        users = {
            user.id: user
            for user in User.select(User.id, User.nickname, User.email).where(User.status == StatusEnum.VALID.value)
        }
        rows = []
        for tenant in Tenant.select(Tenant.id, Tenant.name).where(Tenant.status == StatusEnum.VALID.value):
            owner = users.get(tenant.id)
            rows.append(
                {
                    "id": tenant.id,
                    "name": (owner.nickname or owner.email) if owner else (tenant.name or tenant.id),
                    "type": "personal" if owner else "team",
                }
            )
        return sorted(rows, key=lambda row: (row["type"], row["name"].casefold(), row["id"]))

    @classmethod
    def list_models(cls) -> list[dict[str, Any]]:
        entries = SharedModelService.list_entries()
        if not entries:
            return []
        models = {model.id: model for model in TenantModelService.get_models_by_ids(set(entries))}
        provider_ids = {model.provider_id for model in models.values()}
        instance_ids = {model.instance_id for model in models.values()}
        providers = {
            provider.id: provider
            for provider in TenantModelProvider.select().where(TenantModelProvider.id.in_(provider_ids))
        }
        instances = {
            instance.id: instance
            for instance in TenantModelInstance.select().where(TenantModelInstance.id.in_(instance_ids))
        }
        workspaces = {workspace["id"]: workspace for workspace in cls.list_workspaces()}
        rows = []
        for model_id, entry in entries.items():
            model = models.get(model_id)
            provider = providers.get(model.provider_id) if model else None
            instance = instances.get(model.instance_id) if model else None
            if not model or not provider or not instance:
                continue
            instance_extra = cls._parse_extra(instance.extra)
            model_extra = cls._parse_extra(model.extra)
            target_ids = entry.get("workspace_ids") or []
            rows.append(
                {
                    "id": model.id,
                    "name": model.model_name,
                    "provider_name": provider.provider_name,
                    "provider_id": provider.id,
                    "owner_workspace_id": provider.tenant_id,
                    "instance_name": instance.instance_name,
                    "instance_id": instance.id,
                    "api_key": instance.api_key,
                    "base_url": instance_extra.get("base_url", ""),
                    "model_types": get_model_type_human(model.model_type),
                    "max_tokens": int(model_extra.get("max_tokens") or 8192),
                    "status": model.status,
                    "visibility": entry.get("visibility", "all"),
                    "workspace_ids": target_ids,
                    "workspaces": [workspaces[workspace_id] for workspace_id in target_ids if workspace_id in workspaces],
                    "created_by": entry.get("created_by", ""),
                    "create_date": model.create_date,
                    "update_date": model.update_date,
                }
            )
        return sorted(rows, key=lambda row: (row["provider_name"], row["instance_name"], row["name"]))

    @classmethod
    def create_model(cls, actor_id: str, data: dict[str, Any]) -> dict[str, Any]:
        provider_name = str(data.get("provider_name") or "").strip()
        instance_name = str(data.get("instance_name") or "").strip()
        model_name = str(data.get("model_name") or "").strip()
        model_types = sorted(set(data.get("model_types") or []))
        if provider_name not in cls.PROVIDERS:
            raise AdminException("Unsupported model provider", 400)
        if not instance_name or not model_name:
            raise AdminException("instance_name and model_name are required", 400)
        if not model_types or not set(model_types) <= cls.MODEL_TYPES:
            raise AdminException("At least one valid model type is required", 400)
        visibility, workspace_ids = cls._validate_access(
            data.get("visibility", "all"),
            data.get("workspace_ids") or [],
        )

        provider = TenantModelProviderService.get_by_tenant_id_and_provider_name(actor_id, provider_name)
        if not provider:
            TenantModelProviderService.insert(tenant_id=actor_id, provider_name=provider_name)
            provider = TenantModelProviderService.get_by_tenant_id_and_provider_name(actor_id, provider_name)

        instance = TenantModelInstanceService.get_by_provider_id_and_instance_name(provider.id, instance_name)
        api_key = str(data.get("api_key") or "")
        base_url = str(data.get("base_url") or "").strip()
        if instance and TenantModelService.get_by_provider_id_and_instance_id_and_model_name(
            provider.id,
            instance.id,
            model_name,
        ):
            raise AdminException("Model already exists in this instance", 409)
        if not instance:
            TenantModelInstanceService.create_instance(
                provider_id=provider.id,
                instance_name=instance_name,
                api_key=api_key,
                extra=json.dumps({"base_url": base_url}),
            )
            instance = TenantModelInstanceService.get_by_provider_id_and_instance_name(provider.id, instance_name)
        else:
            instance_extra = cls._parse_extra(instance.extra)
            instance_extra["base_url"] = base_url
            TenantModelInstanceService.update_by_id(
                instance.id,
                {"api_key": api_key, "extra": json.dumps(instance_extra)},
            )

        TenantModelService.insert(
            model_name=model_name,
            provider_id=provider.id,
            instance_id=instance.id,
            model_type=calculate_model_type(model_types),
            status=ActiveStatusEnum.ACTIVE.value,
            extra=json.dumps({"max_tokens": max(int(data.get("max_tokens") or 8192), 1)}),
        )
        model = TenantModelService.get_by_provider_id_and_instance_id_and_model_name(
            provider.id,
            instance.id,
            model_name,
        )
        SharedModelService.set_access(
            model.id,
            visibility=visibility,
            workspace_ids=workspace_ids,
            created_by=actor_id,
        )
        return next(row for row in cls.list_models() if row["id"] == model.id)

    @classmethod
    def update_model(cls, model_id: str, data: dict[str, Any]) -> dict[str, Any]:
        entry = SharedModelService.get_entry(model_id)
        ok, model = TenantModelService.get_by_id(model_id)
        if not entry or not ok:
            raise AdminException("Managed model not found", 404)

        updates = {}
        if "model_types" in data:
            model_types = sorted(set(data.get("model_types") or []))
            if not model_types or not set(model_types) <= cls.MODEL_TYPES:
                raise AdminException("At least one valid model type is required", 400)
            updates["model_type"] = calculate_model_type(model_types)
        if "status" in data:
            if data["status"] not in {ActiveStatusEnum.ACTIVE.value, ActiveStatusEnum.INACTIVE.value}:
                raise AdminException("Invalid model status", 400)
            updates["status"] = data["status"]
        model_extra = cls._parse_extra(model.extra)
        if "max_tokens" in data:
            model_extra["max_tokens"] = max(int(data.get("max_tokens") or 8192), 1)
            updates["extra"] = json.dumps(model_extra)
        if updates:
            TenantModelService.update_model(model_id, updates)

        ok, instance = TenantModelInstanceService.get_by_id(model.instance_id)
        if not ok:
            raise AdminException("Model instance not found", 404)
        instance_updates = {}
        if "api_key" in data:
            instance_updates["api_key"] = str(data.get("api_key") or "")
        if "base_url" in data:
            instance_extra = cls._parse_extra(instance.extra)
            instance_extra["base_url"] = str(data.get("base_url") or "").strip()
            instance_updates["extra"] = json.dumps(instance_extra)
        if instance_updates:
            TenantModelInstanceService.update_by_id(instance.id, instance_updates)

        visibility, workspace_ids = cls._validate_access(
            data.get("visibility", entry.get("visibility", "all")),
            data.get("workspace_ids", entry.get("workspace_ids") or []),
        )
        SharedModelService.set_access(
            model_id,
            visibility=visibility,
            workspace_ids=workspace_ids,
            created_by=entry.get("created_by", ""),
        )
        return next(row for row in cls.list_models() if row["id"] == model_id)

    @classmethod
    def delete_model(cls, model_id: str) -> bool:
        if not SharedModelService.is_managed(model_id):
            raise AdminException("Managed model not found", 404)
        ok, model = TenantModelService.get_by_id(model_id)
        if not ok:
            SharedModelService.remove(model_id)
            raise AdminException("Managed model not found", 404)
        ok, provider = TenantModelProviderService.get_by_id(model.provider_id)
        if not ok:
            raise AdminException("Model provider not found", 404)

        base_target = ResourceReferenceService.build_model_targets(provider.tenant_id, [model])[0]
        targets = []
        for tenant in Tenant.select(Tenant.id).where(Tenant.status == StatusEnum.VALID.value):
            targets.append({**base_target, "tenant_id": tenant.id})
        ResourceReferenceService.ensure_not_referenced("model", targets)

        TenantModelService.delete_by_id(model_id)
        SharedModelService.remove(model_id)
        if not TenantModelService.get_models_by_instance_id(model.instance_id):
            TenantModelInstanceService.delete_by_id(model.instance_id)
        if not TenantModelInstanceService.get_all_by_provider_id(model.provider_id):
            TenantModelProviderService.delete_by_id(model.provider_id)
        return True


class ServiceMgr:
    @staticmethod
    def get_all_services():
        doc_engine = os.getenv("DOC_ENGINE", "elasticsearch")
        result = []
        configs = SERVICE_CONFIGS.configs
        for service_id, config in enumerate(configs):
            config_dict = config.to_dict()
            if config_dict["service_type"] == "retrieval":
                if config_dict["extra"]["retrieval_type"] != doc_engine:
                    continue
            try:
                service_detail = ServiceMgr.get_service_details(service_id)
                if "status" in service_detail:
                    config_dict["status"] = service_detail["status"]
                else:
                    config_dict["status"] = "timeout"
            except Exception as e:
                logging.warning(f"Can't get service details, error: {e}")
                config_dict["status"] = "timeout"
            if not config_dict["host"]:
                config_dict["host"] = "-"
            if not config_dict["port"]:
                config_dict["port"] = "-"
            result.append(config_dict)
        return result

    @staticmethod
    def get_services_by_type(service_type_str: str):
        raise AdminException("get_services_by_type: not implemented")

    @staticmethod
    def get_service_details(service_id: int):
        service_idx = int(service_id)
        configs = SERVICE_CONFIGS.configs
        if service_idx < 0 or service_idx >= len(configs):
            raise AdminException(f"invalid service_index: {service_idx}")

        service_config = configs[service_idx]

        # exclude retrieval service if retrieval_type is not matched
        doc_engine = os.getenv("DOC_ENGINE", "elasticsearch")
        if service_config.service_type == "retrieval":
            if service_config.retrieval_type != doc_engine:
                raise AdminException(f"invalid service_index: {service_idx}")

        service_info = {"name": service_config.name, "detail_func_name": service_config.detail_func_name}

        detail_func = getattr(health_utils, service_info.get("detail_func_name"))
        res = detail_func()
        res.update({"service_name": service_info.get("name")})
        return res

    @staticmethod
    def shutdown_service(service_id: int):
        raise AdminException("shutdown_service: not implemented")

    @staticmethod
    def restart_service(service_id: int):
        raise AdminException("restart_service: not implemented")


class MonitoringMgr:
    """Build a real-time operational overview without persisting snapshots."""

    @staticmethod
    def get_summary():
        valid = StatusEnum.VALID.value
        users_total = User.select().where(User.status == valid).count()
        active_users = User.select().where((User.status == valid) & (User.is_active == ActiveEnum.ACTIVE.value)).count()
        teams_total = (
            Tenant.select()
            .where((Tenant.status == valid) & ~(Tenant.id.in_(User.select(User.id))))
            .count()
        )
        datasets_total = Knowledgebase.select().where(Knowledgebase.status == valid).count()
        documents = (
            Document.select()
            .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
            .join(Tenant, on=(Knowledgebase.tenant_id == Tenant.id))
            .where(
                (Document.status == valid)
                & (Knowledgebase.status == valid)
                & (Tenant.status == valid)
            )
        )
        documents_total = documents.count()
        storage_bytes = documents.select(fn.COALESCE(fn.SUM(Document.size), 0)).scalar() or 0
        files = (
            File.select()
            .join(Tenant, on=(File.tenant_id == Tenant.id))
            .where(
                (File.type != FileType.FOLDER.value)
                & (Tenant.status == valid)
            )
        )
        files_total = files.count()
        files_storage_bytes = files.select(fn.COALESCE(fn.SUM(File.size), 0)).scalar() or 0
        failed_documents = documents.where(Document.progress < 0).count()
        processing_documents = documents.where((Document.progress >= 0) & (Document.progress < 1)).count()
        pending_tasks = Task.select().where((Task.progress >= 0) & (Task.progress < 1)).count()
        chats_total = Dialog.select().where(Dialog.status == valid).count()
        searches_total = Search.select().where(Search.status == valid).count()
        agents_total = UserCanvas.select().where(UserCanvas.canvas_category == CanvasCategory.Agent.value).count()
        memories_total = Memory.select().count()

        return {
            "users_total": users_total,
            "active_users": active_users,
            "teams_total": teams_total,
            "datasets_total": datasets_total,
            "documents_total": documents_total,
            "storage_bytes": int(storage_bytes),
            "files_total": files_total,
            "files_storage_bytes": int(files_storage_bytes),
            "failed_documents": failed_documents,
            "processing_documents": processing_documents,
            "pending_tasks": pending_tasks,
            "chats_total": chats_total,
            "searches_total": searches_total,
            "agents_total": agents_total,
            "memories_total": memories_total,
            "storage_distribution": MonitoringMgr.get_storage_distribution(),
        }

    @staticmethod
    def get_storage_distribution():
        valid = StatusEnum.VALID.value
        rows = list(
            Document.select(
                Knowledgebase.tenant_id.alias("workspace_id"),
                fn.COUNT(Document.id).alias("files_total"),
                fn.COALESCE(fn.SUM(Document.size), 0).alias("storage_bytes"),
            )
            .join(Knowledgebase, on=(Document.kb_id == Knowledgebase.id))
            .join(Tenant, on=(Knowledgebase.tenant_id == Tenant.id))
            .where(
                (Document.status == valid)
                & (Knowledgebase.status == valid)
                & (Tenant.status == valid)
            )
            .group_by(Knowledgebase.tenant_id)
            .order_by(fn.SUM(Document.size).desc(), Knowledgebase.tenant_id.asc())
            .dicts()
        )
        ResourceMgr._attach_ownership(rows)
        for row in rows:
            row["files_total"] = int(row.get("files_total", 0) or 0)
            row["storage_bytes"] = int(row.get("storage_bytes", 0) or 0)
        return rows


class SettingsMgr:
    @staticmethod
    def _format_setting(setting):
        return {
            "data_type": setting.data_type,
            "name": setting.name,
            "setting_type": "config",
            "value": setting.value,
        }

    @staticmethod
    def _validate_value(name: str, data_type: str, value: str):
        data_type = data_type.lower()
        value = str(value)
        if data_type == "string":
            return
        if data_type == "integer":
            try:
                int(value)
            except ValueError:
                raise AdminException(f"Invalid integer value for {name}: {value}")
            return
        if data_type in {"bool", "boolean"}:
            if value not in {"true", "false"}:
                raise AdminException(f"Invalid bool value for {name}: expected true or false")
            return
        if data_type == "json":
            try:
                json.loads(value)
            except json.JSONDecodeError:
                raise AdminException(f"Invalid JSON value for {name}")
            return
        raise AdminException(f"Unsupported data type for {name}: {data_type}")

    @staticmethod
    def _infer_data_type(name: str):
        if name.startswith("sandbox."):
            return "json"
        if name.endswith(".enabled"):
            return "bool"
        return "string"

    @staticmethod
    def get_all():
        settings = SystemSettingsService.get_all(reverse=False, order_by="name")
        result = []
        for setting in settings:
            result.append(SettingsMgr._format_setting(setting))
        return result

    @staticmethod
    def get_by_name(name: str):
        settings = SystemSettingsService.get_by_name(name)
        if len(settings) == 0:
            settings = SystemSettingsService.get_by_name_prefix(name)
            if len(settings) == 0:
                raise AdminException(f"Can't get setting: {name}")
        result = []
        for setting in settings:
            result.append(SettingsMgr._format_setting(setting))
        return result

    @staticmethod
    def update_by_name(name: str, value: str):
        settings = SystemSettingsService.get_by_name(name)
        if len(settings) == 1:
            setting = settings[0]
            SettingsMgr._validate_value(name, setting.data_type, value)
            setting.value = value
            setting_dict = setting.to_dict()
            SystemSettingsService.update_by_name(name, setting_dict)
        elif len(settings) > 1:
            raise AdminException(f"Can't update more than 1 setting: {name}")
        else:
            # Create new setting if it doesn't exist

            # Determine data_type based on name and value
            data_type = SettingsMgr._infer_data_type(name)
            SettingsMgr._validate_value(name, data_type, value)

            new_setting = {
                "name": name,
                "value": str(value),
                "source": "admin",
                "data_type": data_type,
            }
            SystemSettingsService.save(**new_setting)


class ConfigMgr:
    @staticmethod
    def get_all():
        result = []
        configs = SERVICE_CONFIGS.configs
        for config in configs:
            config_dict = config.to_dict()
            result.append(config_dict)
        return result


class EnvironmentsMgr:
    @staticmethod
    def get_all():
        result = []

        env_kv = {"env": "DOC_ENGINE", "value": os.getenv("DOC_ENGINE")}
        result.append(env_kv)

        env_kv = {"env": "DEFAULT_SUPERUSER_EMAIL", "value": os.getenv("DEFAULT_SUPERUSER_EMAIL", "admin@ragflow.io")}
        result.append(env_kv)

        env_kv = {"env": "DB_TYPE", "value": os.getenv("DB_TYPE", "mysql")}
        result.append(env_kv)

        env_kv = {"env": "DEVICE", "value": os.getenv("DEVICE", "cpu")}
        result.append(env_kv)

        env_kv = {"env": "STORAGE_IMPL", "value": os.getenv("STORAGE_IMPL", "MINIO")}
        result.append(env_kv)

        return result


class SandboxMgr:
    """Manager for sandbox provider configuration and operations."""

    # Provider registry with metadata
    PROVIDER_REGISTRY = {
        "local": {
            "name": "Local",
            "description": "Execute code directly on the current host process.",
            "tags": ["local", "host", "minimal"],
        },
        "self_managed": {
            "name": "Self-Managed",
            "description": "On-premise deployment using Daytona/Docker",
            "tags": ["self-hosted", "low-latency", "secure"],
        },
        "ssh": {
            "name": "SSH",
            "description": "Execute code on a remote machine over SSH.",
            "tags": ["remote", "ssh", "custom-runtime"],
        },
        "aliyun_codeinterpreter": {
            "name": "Aliyun Code Interpreter",
            "description": "Aliyun Function Compute Code Interpreter - Code execution in serverless microVMs",
            "tags": ["saas", "cloud", "scalable", "aliyun"],
        },
        "e2b": {
            "name": "E2B",
            "description": "E2B Cloud - Code Execution Sandboxes",
            "tags": ["saas", "fast", "global"],
        },
    }

    @staticmethod
    def list_providers():
        """List all available sandbox providers."""
        result = []
        for provider_id, metadata in SandboxMgr.PROVIDER_REGISTRY.items():
            result.append({"id": provider_id, **metadata})
        return result

    @staticmethod
    def get_provider_config_schema(provider_id: str):
        """Get configuration schema for a specific provider."""
        from agent.sandbox.providers import (
            LocalProvider,
            SelfManagedProvider,
            SSHProvider,
            AliyunCodeInterpreterProvider,
            E2BProvider,
        )

        schemas = {
            "local": LocalProvider.get_config_schema(),
            "self_managed": SelfManagedProvider.get_config_schema(),
            "ssh": SSHProvider.get_config_schema(),
            "aliyun_codeinterpreter": AliyunCodeInterpreterProvider.get_config_schema(),
            "e2b": E2BProvider.get_config_schema(),
        }

        if provider_id not in schemas:
            raise AdminException(f"Unknown provider: {provider_id}")

        return schemas.get(provider_id, {})

    @staticmethod
    def get_config():
        """Get current sandbox configuration."""
        try:
            # Get active provider type
            provider_type_settings = SystemSettingsService.get_by_name("sandbox.provider_type")
            if not provider_type_settings:
                provider_type = "self_managed"
            else:
                provider_type = provider_type_settings[0].value

            # Get provider-specific config
            provider_config_settings = SystemSettingsService.get_by_name(f"sandbox.{provider_type}")
            if not provider_config_settings:
                provider_config = {}
            else:
                try:
                    provider_config = json.loads(provider_config_settings[0].value)
                except json.JSONDecodeError:
                    provider_config = {}

            if not provider_config:
                schema = SandboxMgr.get_provider_config_schema(provider_type)
                provider_config = {}
                for field_name, field_schema in schema.items():
                    if field_schema.get("readonly"):
                        continue
                    if field_schema.get("default") is not None:
                        provider_config[field_name] = field_schema["default"]

            return {
                "provider_type": provider_type,
                "config": provider_config,
            }
        except Exception as e:
            raise AdminException(f"Failed to get sandbox config: {str(e)}")

    @staticmethod
    def set_config(provider_type: str, config: dict, set_active: bool = True):
        """
        Set sandbox provider configuration.

        Args:
            provider_type: Provider identifier (e.g., "self_managed", "e2b")
            config: Provider configuration dictionary
            set_active: If True, also update the active provider. If False,
                       only update the configuration without switching providers.
                       Default: True

        Returns:
            Dictionary with updated provider_type and config
        """
        from agent.sandbox.providers import (
            LocalProvider,
            SelfManagedProvider,
            SSHProvider,
            AliyunCodeInterpreterProvider,
            E2BProvider,
        )

        try:
            # Validate provider type
            if provider_type not in SandboxMgr.PROVIDER_REGISTRY:
                raise AdminException(f"Unknown provider type: {provider_type}")

            # Get provider schema for validation
            schema = SandboxMgr.get_provider_config_schema(provider_type)

            # Validate config against schema
            for field_name, field_schema in schema.items():
                if field_schema.get("required", False) and field_name not in config:
                    raise AdminException(f"Required field '{field_name}' is missing")

                # Type validation
                if field_name in config:
                    field_type = field_schema.get("type")
                    if field_type == "integer":
                        if not isinstance(config[field_name], int):
                            raise AdminException(f"Field '{field_name}' must be an integer")
                    elif field_type == "string":
                        if not isinstance(config[field_name], str):
                            raise AdminException(f"Field '{field_name}' must be a string")
                    elif field_type == "boolean":
                        if not isinstance(config[field_name], bool):
                            raise AdminException(f"Field '{field_name}' must be a boolean")

                    # Range validation for integers
                    if field_type == "integer" and field_name in config:
                        min_val = field_schema.get("min")
                        max_val = field_schema.get("max")
                        if min_val is not None and config[field_name] < min_val:
                            raise AdminException(f"Field '{field_name}' must be >= {min_val}")
                        if max_val is not None and config[field_name] > max_val:
                            raise AdminException(f"Field '{field_name}' must be <= {max_val}")

            # Provider-specific custom validation
            provider_classes = {
                "local": LocalProvider,
                "self_managed": SelfManagedProvider,
                "ssh": SSHProvider,
                "aliyun_codeinterpreter": AliyunCodeInterpreterProvider,
                "e2b": E2BProvider,
            }
            provider = provider_classes[provider_type]()
            is_valid, error_msg = provider.validate_config(config)
            if not is_valid:
                raise AdminException(f"Provider validation failed: {error_msg}")

            # Update provider_type only if set_active is True
            if set_active:
                SettingsMgr.update_by_name("sandbox.provider_type", provider_type)

            # Always update the provider config
            config_json = json.dumps(config)
            SettingsMgr.update_by_name(f"sandbox.{provider_type}", config_json)
            from agent.sandbox.client import reload_provider

            reload_provider()

            return {"provider_type": provider_type, "config": config}
        except AdminException:
            raise
        except Exception as e:
            raise AdminException(f"Failed to set sandbox config: {str(e)}")

    @staticmethod
    def test_connection(provider_type: str, config: dict):
        """
        Test connection to sandbox provider by executing a simple Python script.

        This creates a temporary sandbox instance and runs a test code to verify:
        - Connection credentials are valid
        - Sandbox can be created
        - Code execution works correctly

        Args:
            provider_type: Provider identifier
            config: Provider configuration dictionary

        Returns:
            dict with test results including stdout, stderr, exit_code, execution_time
        """
        try:
            from agent.sandbox.providers import (
                LocalProvider,
                SelfManagedProvider,
                SSHProvider,
                AliyunCodeInterpreterProvider,
                E2BProvider,
            )

            # Instantiate provider based on type
            provider_classes = {
                "local": LocalProvider,
                "self_managed": SelfManagedProvider,
                "ssh": SSHProvider,
                "aliyun_codeinterpreter": AliyunCodeInterpreterProvider,
                "e2b": E2BProvider,
            }

            if provider_type not in provider_classes:
                raise AdminException(f"Unknown provider type: {provider_type}")

            provider = provider_classes[provider_type]()

            # Initialize with config
            if not provider.initialize(config):
                raise AdminException(f"Failed to initialize provider '{provider_type}'")

            # Create a temporary sandbox instance for testing
            instance = provider.create_instance(template="python")
            if not instance:
                raise AdminException("Failed to create sandbox instance.")

            try:
                # Keep the probe close to the original coverage, but avoid
                # `sys` because the sandbox security analyzer blocks it.
                test_code = """
import json
import math


def main() -> dict:
    left = 2
    right = 2
    print(f"2 + 2 = {left + right}")
    print(f"JSON dump: {json.dumps({'test': 'data', 'value': 123})}")
    print(f"Math.sqrt(16) = {math.sqrt(16)}")
    print("TEST_PASSED")
    return {"ok": True, "provider_test": "TEST_PASSED"}
"""

                # Execute test code with timeout
                execution_result = provider.execute_code(
                    instance_id=instance.instance_id,
                    code=test_code,
                    language="python",
                    timeout=10,
                )
            finally:
                try:
                    provider.destroy_instance(instance.instance_id)
                    logging.info(f"Cleaned up test instance {instance.instance_id}")
                except Exception as cleanup_error:
                    logging.warning(f"Failed to cleanup test instance {instance.instance_id}: {cleanup_error}")

            # Build detailed result message
            success = execution_result.exit_code == 0 and "TEST_PASSED" in execution_result.stdout

            message_parts = [f"Test {success and 'PASSED' or 'FAILED'}", f"Exit code: {execution_result.exit_code}", f"Execution time: {execution_result.execution_time:.2f}s"]

            if execution_result.stdout.strip():
                stdout_preview = execution_result.stdout.strip()[:200]
                message_parts.append(f"Output: {stdout_preview}...")

            if execution_result.stderr.strip():
                stderr_preview = execution_result.stderr.strip()[:200]
                message_parts.append(f"Errors: {stderr_preview}...")

            message = " | ".join(message_parts)

            return {
                "success": success,
                "message": message,
                "details": {
                    "exit_code": execution_result.exit_code,
                    "execution_time": execution_result.execution_time,
                    "stdout": execution_result.stdout,
                    "stderr": execution_result.stderr,
                },
            }

        except AdminException:
            raise
        except Exception as e:
            import traceback

            error_details = traceback.format_exc()
            raise AdminException(f"Connection test failed: {str(e)}\\n\\nStack trace:\\n{error_details}")
