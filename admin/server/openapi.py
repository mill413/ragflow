"""OpenAPI specification generation for the administrator service."""

import re
from copy import deepcopy

from flask import Flask


_SUMMARY_BY_ENDPOINT = {
    "ping": "检查管理服务状态",
    "login": "管理员登录",
    "logout": "管理员退出登录",
    "list_users": "列出用户",
    "create_user": "创建用户",
    "import_users": "批量导入用户",
    "update_user_department": "修改用户部门",
    "get_user_login_url": "生成用户跳转链接",
    "delete_user": "删除用户",
    "update_user": "修改用户信息",
    "change_password": "修改用户密码",
    "update_user_quota": "修改用户配额",
    "alter_user_activate_status": "修改用户启用状态",
    "grant_admin": "授予超级管理员权限",
    "revoke_admin": "撤销超级管理员权限",
    "get_user_details": "获取用户详情",
    "get_user_datasets": "列出用户知识库",
    "get_user_agents": "列出用户智能体",
    "get_user_resources": "列出用户相关资源",
    "list_teams": "列出团队",
    "create_team": "创建团队",
    "update_team": "修改团队",
    "delete_team": "删除团队",
    "list_team_members": "列出团队成员",
    "update_team_quota": "修改团队配额",
    "list_team_resources": "列出团队资源",
    "add_team_member": "添加团队成员",
    "update_team_member": "修改团队成员角色",
    "delete_team_member": "移除团队成员",
    "list_departments": "列出部门",
    "create_department": "创建部门",
    "update_department": "修改部门",
    "delete_department": "删除部门",
    "list_resources": "列出受管资源",
    "list_failed_documents": "列出解析失败文件",
    "get_resource_detail": "获取资源详情",
    "list_chat_sessions": "列出聊天会话",
    "get_chat_session_detail": "获取聊天会话详情",
    "delete_resource": "删除资源",
    "update_dataset_quota": "修改知识库配额",
    "list_quotas": "列出配额",
    "update_quota": "修改配额",
    "list_managed_models": "列出模型",
    "list_model_workspaces": "列出模型可用工作空间",
    "list_workspace_chunk_methods": "列出工作空间分块方法",
    "update_workspace_chunk_method": "修改分块方法可见性",
    "create_managed_model": "创建共享模型",
    "verify_managed_model": "验证模型连接",
    "update_managed_model": "修改模型",
    "delete_managed_model": "删除模型",
    "get_services": "列出服务",
    "get_services_by_type": "按类型列出服务",
    "get_service": "获取服务详情",
    "shutdown_service": "停止服务",
    "restart_service": "重启服务",
    "create_role": "创建角色",
    "update_role": "修改角色",
    "delete_role": "删除角色",
    "list_roles": "列出角色",
    "get_role_permission": "获取角色权限",
    "grant_role_permission": "授予角色权限",
    "revoke_role_permission": "撤销角色权限",
    "update_user_role": "修改用户角色",
    "get_user_permission": "获取用户权限",
    "set_variable": "设置系统变量",
    "get_variable": "获取系统变量",
    "get_config": "获取系统配置",
    "get_environments": "获取环境信息",
    "list_api_tokens": "列出 API Token",
    "create_api_token": "创建 API Token",
    "list_api_token_workspaces": "列出 Token 可选工作空间",
    "get_api_token": "获取 API Token 详情",
    "delete_api_token": "删除 API Token",
    "generate_user_api_key": "生成用户 API Key",
    "get_user_api_keys": "列出用户 API Key",
    "delete_user_api_key": "删除用户 API Key",
    "show_version": "获取系统版本",
    "monitoring_summary": "获取监控总览",
    "list_sandbox_providers": "列出沙箱提供商",
    "get_sandbox_provider_schema": "获取沙箱配置结构",
    "get_sandbox_config": "获取沙箱配置",
    "set_sandbox_config": "保存沙箱配置",
    "test_sandbox_connection": "测试沙箱连接",
    "get_logger_levels": "获取日志级别",
    "set_logger_level": "修改日志级别",
    "admin_openapi": "获取管理 API OpenAPI 规范",
}

_TAG_BY_PREFIX = {
    "users": "用户管理",
    "teams": "团队管理",
    "departments": "部门管理",
    "resources": "资源管理",
    "quotas": "配额管理",
    "models": "模型管理",
    "workspaces": "工作空间",
    "api-tokens": "Token 管理",
    "services": "服务管理",
    "service_types": "服务管理",
    "monitoring": "系统监控",
    "roles": "权限管理",
    "variables": "系统设置",
    "configs": "系统设置",
    "environments": "系统设置",
    "sandbox": "沙箱设置",
    "log_levels": "系统设置",
}

_QUERY_PARAMETERS = {
    ("get", "/api/v1/admin/departments"): [
        {"name": "q", "description": "部门名称或路径关键字", "schema": {"type": "string"}},
    ],
    ("get", "/api/v1/admin/resources"): [
        {"name": "type", "description": "资源类型", "schema": {"type": "string", "enum": ["dataset", "chat", "search", "agent", "memory", "file"]}},
        {"name": "page", "schema": {"type": "integer", "minimum": 1, "default": 1}},
        {"name": "page_size", "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20}},
        {"name": "keywords", "schema": {"type": "string"}},
        {"name": "workspace_ids", "description": "逗号分隔的工作空间 ID", "schema": {"type": "string"}},
        {"name": "hierarchy", "description": "文件资源是否按目录树返回", "schema": {"type": "boolean", "default": False}},
    ],
    ("get", "/api/v1/admin/resources/failures"): [
        {"name": "page", "schema": {"type": "integer", "minimum": 1, "default": 1}},
        {"name": "page_size", "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20}},
        {"name": "keywords", "schema": {"type": "string"}},
        {"name": "workspace_ids", "description": "逗号分隔的工作空间 ID", "schema": {"type": "string"}},
    ],
    ("get", "/api/v1/admin/resources/{resource_type}/{resource_id}"): [
        {"name": "page", "schema": {"type": "integer", "minimum": 1, "default": 1}},
        {"name": "page_size", "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20}},
    ],
    ("get", "/api/v1/admin/resources/chat/{resource_id}/sessions"): [
        {"name": "page", "schema": {"type": "integer", "minimum": 1, "default": 1}},
        {"name": "page_size", "schema": {"type": "integer", "minimum": 1, "maximum": 100, "default": 20}},
        {"name": "sources", "description": "逗号分隔的会话来源", "schema": {"type": "string"}},
        {"name": "keywords", "schema": {"type": "string"}},
    ],
    ("get", "/api/v1/admin/resources/chat/{resource_id}/sessions/{session_id}"): [
        {"name": "source", "description": "会话来源", "schema": {"type": "string", "default": "web"}},
    ],
}

def _schema_ref(name: str):
    return {"$ref": f"#/components/schemas/{name}"}

_REQUEST_BODIES = {
    ("post", "/api/v1/admin/login"): _schema_ref("AdminLoginRequest"),
    ("post", "/api/v1/admin/users"): _schema_ref("UserCreateRequest"),
    ("post", "/api/v1/admin/users/batch"): _schema_ref("UserImportRequest"),
    ("put", "/api/v1/admin/users/{username}/department"): _schema_ref("DepartmentAssignmentRequest"),
    ("patch", "/api/v1/admin/users/{username}"): _schema_ref("UserUpdateRequest"),
    ("put", "/api/v1/admin/users/{username}/password"): _schema_ref("PasswordRequest"),
    ("put", "/api/v1/admin/users/{username}/quota"): _schema_ref("QuotaRequest"),
    ("put", "/api/v1/admin/users/{username}/activate"): _schema_ref("ActivationRequest"),
    ("post", "/api/v1/admin/teams"): _schema_ref("TeamRequest"),
    ("put", "/api/v1/admin/teams/{team_id}"): _schema_ref("TeamRequest"),
    ("put", "/api/v1/admin/teams/{team_id}/quota"): _schema_ref("QuotaRequest"),
    ("post", "/api/v1/admin/teams/{team_id}/members"): _schema_ref("TeamMemberRequest"),
    ("put", "/api/v1/admin/teams/{team_id}/members/{user_id}"): _schema_ref("TeamMemberRoleRequest"),
    ("post", "/api/v1/admin/departments"): _schema_ref("DepartmentRequest"),
    ("put", "/api/v1/admin/departments/{department_id}"): _schema_ref("DepartmentRequest"),
    ("put", "/api/v1/admin/resources/dataset/{resource_id}/quota"): _schema_ref("QuotaRequest"),
    ("put", "/api/v1/admin/quotas/{scope_type}/{scope_id}"): _schema_ref("QuotaRequest"),
    ("patch", "/api/v1/admin/workspaces/{workspace_id}/chunk-methods/{parser_id}"): _schema_ref("ChunkMethodRequest"),
    ("post", "/api/v1/admin/models"): _schema_ref("ManagedModelRequest"),
    ("post", "/api/v1/admin/models/verify"): _schema_ref("ManagedModelRequest"),
    ("patch", "/api/v1/admin/models/{model_id}"): _schema_ref("ManagedModelRequest"),
    ("post", "/api/v1/admin/roles"): _schema_ref("RoleCreateRequest"),
    ("put", "/api/v1/admin/roles/{role_name}"): _schema_ref("RoleUpdateRequest"),
    ("post", "/api/v1/admin/roles/{role_name}/permission"): _schema_ref("PermissionRequest"),
    ("delete", "/api/v1/admin/roles/{role_name}/permission"): _schema_ref("PermissionRequest"),
    ("put", "/api/v1/admin/users/{user_name}/role"): _schema_ref("UserRoleRequest"),
    ("put", "/api/v1/admin/variables"): _schema_ref("VariableRequest"),
    ("post", "/api/v1/admin/api-tokens"): _schema_ref("ApiTokenRequest"),
    ("post", "/api/v1/admin/sandbox/config"): _schema_ref("SandboxConfigRequest"),
    ("post", "/api/v1/admin/sandbox/test"): _schema_ref("SandboxConfigRequest"),
    ("put", "/api/v1/admin/log_levels"): _schema_ref("LogLevelRequest"),
}

_NO_REQUEST_BODY = {
    ("post", "/api/v1/admin/users/{username}/login-url"),
    ("put", "/api/v1/admin/users/{username}/admin"),
    ("post", "/api/v1/admin/users/{username}/keys"),
    ("put", "/api/v1/admin/services/{service_id}"),
}


def _object_schema(properties, required=()):
    schema = {"type": "object", "properties": properties, "additionalProperties": False}
    if required:
        schema["required"] = list(required)
    return schema


_COMPONENT_SCHEMAS = {
    "AdminLoginRequest": _object_schema({"email": {"type": "string", "format": "email"}, "password": {"type": "string", "description": "前端 RSA 加密后的密码"}}, ("email", "password")),
    "UserCreateRequest": _object_schema(
        {
            "username": {"type": "string", "format": "email"},
            "nickname": {"type": "string"},
            "password": {"type": "string"},
            "role": {"type": "string", "default": "user"},
            "department_id": {"type": ["string", "null"]},
        },
        ("username", "password"),
    ),
    "UserImportRequest": _object_schema(
        {
            "users": {
                "type": "array",
                "items": _object_schema(
                    {
                        "email": {"type": "string", "format": "email"},
                        "nickname": {"type": "string"},
                        "password": {"type": "string"},
                        "department_path": {"type": "string", "example": "总部/研发部"},
                    },
                    ("email", "password"),
                ),
            }
        },
        ("users",),
    ),
    "DepartmentAssignmentRequest": _object_schema({"department_id": {"type": ["string", "null"]}}),
    "UserUpdateRequest": _object_schema(
        {
            "nickname": {"type": "string"},
            "department_id": {"type": ["string", "null"]},
            "is_active": {"type": "boolean"},
            "is_superuser": {"type": "boolean"},
            "password": {"type": "string"},
            "remark": {"type": "string"},
        }
    ),
    "PasswordRequest": _object_schema({"new_password": {"type": "string"}}, ("new_password",)),
    "ActivationRequest": _object_schema({"activate_status": {"type": "string", "enum": ["on", "off"]}}, ("activate_status",)),
    "QuotaRequest": _object_schema(
        {
            "file_count_limit": {"type": ["integer", "null"], "minimum": 0},
            "storage_bytes_limit": {"type": ["integer", "null"], "minimum": 0},
            "team_count_limit": {"type": ["integer", "null"], "minimum": 0},
            "dataset_count_limit": {"type": ["integer", "null"], "minimum": 0},
            "chat_count_limit": {"type": ["integer", "null"], "minimum": 0},
            "search_count_limit": {"type": ["integer", "null"], "minimum": 0},
            "agent_count_limit": {"type": ["integer", "null"], "minimum": 0},
            "memory_count_limit": {"type": ["integer", "null"], "minimum": 0},
        }
    ),
    "TeamRequest": _object_schema({"name": {"type": "string"}, "owner_id": {"type": "string"}}, ("name", "owner_id")),
    "TeamMemberRequest": _object_schema({"user_id": {"type": "string"}, "role": {"$ref": "#/components/schemas/TeamRole"}}, ("user_id", "role")),
    "TeamMemberRoleRequest": _object_schema({"role": {"$ref": "#/components/schemas/TeamRole"}}, ("role",)),
    "TeamRole": {"type": "string", "enum": ["owner", "admin", "normal", "invite"]},
    "DepartmentRequest": _object_schema({"name": {"type": "string"}, "parent_id": {"type": ["string", "null"]}}, ("name",)),
    "ChunkMethodRequest": _object_schema({"enabled": {"type": "boolean"}}, ("enabled",)),
    "ManagedModelRequest": _object_schema(
        {
            "provider_name": {"type": "string", "enum": ["MinerU", "OpenAI-API-Compatible", "Xinference"]},
            "instance_name": {"type": "string"},
            "model_name": {"type": "string"},
            "model_types": {"type": "array", "items": {"type": "string"}},
            "api_key": {"type": "string", "format": "password"},
            "base_url": {"type": "string", "format": "uri"},
            "max_tokens": {"type": "integer", "minimum": 0},
            "features": {"type": "array", "items": {"type": "string"}},
            "provider_config": {"type": "object", "additionalProperties": True},
            "status": {"type": "string"},
            "visibility": {"type": "string", "enum": ["all", "selected"], "default": "all"},
            "workspace_ids": {"type": "array", "items": {"type": "string"}},
        },
        ("provider_name", "model_name", "model_types"),
    ),
    "RoleCreateRequest": _object_schema({"role_name": {"type": "string"}, "description": {"type": "string"}}, ("role_name", "description")),
    "RoleUpdateRequest": _object_schema({"description": {"type": "string"}}, ("description",)),
    "PermissionRequest": _object_schema({"actions": {"type": "array", "items": {"type": "string"}}, "resource": {"type": "string"}}, ("actions", "resource")),
    "UserRoleRequest": _object_schema({"role_name": {"type": "string"}}, ("role_name",)),
    "VariableRequest": _object_schema({"var_name": {"type": "string"}, "var_value": {"type": "string"}}, ("var_name", "var_value")),
    "ApiTokenRequest": _object_schema({"workspace_id": {"type": "string"}}, ("workspace_id",)),
    "SandboxConfigRequest": _object_schema(
        {
            "provider_type": {"type": "string"},
            "config": {"type": "object", "additionalProperties": True},
            "set_active": {"type": "boolean", "default": True},
        },
        ("provider_type",),
    ),
    "LogLevelRequest": _object_schema({"pkg_name": {"type": "string"}, "level": {"type": "string", "enum": ["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]}}, ("pkg_name", "level")),
    "ApiResponse": {
        "type": "object",
        "properties": {"code": {"type": "integer"}, "message": {"type": "string"}, "data": {}},
        "required": ["code", "message"],
    },
}


def _to_openapi_path(rule: str) -> str:
    return re.sub(r"<(?:(?:[^:<>]+):)?([^<>]+)>", r"{\1}", rule)


def _tag_for_path(path: str) -> str:
    relative = path.removeprefix("/api/v1/admin/")
    prefix = relative.split("/", 1)[0]
    return _TAG_BY_PREFIX.get(prefix, "管理系统")


def _path_parameters(path: str):
    parameters = []
    for name in re.findall(r"{([^{}]+)}", path):
        schema = {"type": "integer"} if name == "service_id" else {"type": "string"}
        parameters.append({"name": name, "in": "path", "required": True, "schema": schema})
    return parameters


def _query_parameters(method: str, path: str):
    parameters = deepcopy(_QUERY_PARAMETERS.get((method, path), []))
    for parameter in parameters:
        parameter["in"] = "query"
        parameter["required"] = False
    return parameters


def build_admin_openapi_spec(app: Flask):
    """Build a specification from the routes actually registered on ``app``."""

    paths = {}
    for rule in sorted(app.url_map.iter_rules(), key=lambda item: item.rule):
        if not rule.rule.startswith("/api/v1/admin"):
            continue
        path = _to_openapi_path(rule.rule)
        if path == "/api/v1/admin/auth":
            continue
        endpoint = rule.endpoint.rsplit(".", 1)[-1]
        for method_name in sorted(rule.methods - {"HEAD", "OPTIONS"}):
            method = method_name.lower()
            operation = {
                "tags": [_tag_for_path(path)],
                "summary": _SUMMARY_BY_ENDPOINT.get(endpoint, endpoint.replace("_", " ")),
                "operationId": endpoint,
                "parameters": _path_parameters(path) + _query_parameters(method, path),
                "responses": {
                    "200": {
                        "description": "请求已处理；业务结果请检查响应体中的 code 字段",
                        "content": {"application/json": {"schema": _schema_ref("ApiResponse")}},
                    },
                    "401": {"description": "未登录或管理员凭证失效"},
                    "403": {"description": "没有超级管理员权限"},
                },
            }
            body_schema = _REQUEST_BODIES.get((method, path))
            if body_schema is None and method in {"post", "put", "patch"} and (method, path) not in _NO_REQUEST_BODY:
                body_schema = {"type": "object", "additionalProperties": True}
            if body_schema is not None:
                operation["requestBody"] = {
                    "required": True,
                    "content": {"application/json": {"schema": deepcopy(body_schema)}},
                }
            if path not in {"/api/v1/admin/ping", "/api/v1/admin/login"}:
                operation["security"] = [{"adminBearer": []}]
            paths.setdefault(path, {})[method] = operation

    return {
        "openapi": "3.1.0",
        "info": {
            "title": "管理后台 API",
            "version": "1.0.0",
            "description": "当前管理服务实际注册接口的交互式文档。除登录和健康检查外，请求需要超级管理员凭证。",
        },
        "servers": [{"url": "/", "description": "当前部署实例"}],
        "paths": paths,
        "components": {
            "securitySchemes": {
                "adminBearer": {
                    "type": "http",
                    "scheme": "bearer",
                    "description": "当前管理后台登录会话的访问凭证，由文档页面自动设置，无需手动输入",
                },
            },
            "schemas": deepcopy(_COMPONENT_SCHEMAS),
        },
    }
