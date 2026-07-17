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


import logging
import uuid
from functools import wraps
from datetime import datetime

from flask import jsonify, request
from flask_login import current_user, login_user

from api.common.exceptions import AdminException, UserNotFoundError
from api.common.base64 import encode_to_base64
from api.db.services import UserService, generate_access_token, get_user_id_from_access_token
from api.db import UserTenantRole
from api.db.services.user_service import TenantService, UserTenantService
from common.constants import ActiveEnum, StatusEnum
from api.utils.crypt import decrypt
from common.time_utils import current_timestamp, datetime_format, get_format_time
from common.connection_utils import sync_construct_response
from common import settings


def setup_auth(login_manager):
    def load_user_from_token(jwt_token):
        from itsdangerous.url_safe import URLSafeTimedSerializer as Serializer

        try:
            if jwt_token.startswith("Bearer "):
                jwt_token = jwt_token[7:]

            jwt_token = jwt_token.strip()
            if not jwt_token:
                logging.warning("Authentication attempt with empty JWT token")
                return None

            jwt = Serializer(secret_key=settings.get_secret_key())
            access_token = str(jwt.loads(jwt_token))
            user_id = get_user_id_from_access_token(access_token)
            if not user_id:
                logging.warning("Authentication attempt with invalid access token format")
                return None

            users = UserService.query(id=user_id, status=StatusEnum.VALID.value)
            return users[0] if users else None
        except Exception as e:
            logging.warning(f"load_user got exception {e}")
            return None

    @login_manager.user_loader
    def load_user_from_session(session_token):
        return load_user_from_token(session_token)

    @login_manager.request_loader
    def load_user(web_request):
        authorization = web_request.headers.get("Authorization")
        return load_user_from_token(authorization) if authorization else None


def init_default_admin():
    # Verify that at least one active admin user exists. If not, create a default one.
    users = UserService.query(is_superuser=True)
    if not users:
        default_admin = {
            "id": uuid.uuid1().hex,
            "password": encode_to_base64("admin"),
            "nickname": "admin",
            "is_superuser": True,
            "email": "admin@ragflow.io",
            "creator": "system",
            "status": "1",
        }
        if not UserService.save(**default_admin):
            raise AdminException("Can't init admin.", 500)
        add_tenant_for_admin(default_admin, UserTenantRole.OWNER)
    elif not any([u.is_active == ActiveEnum.ACTIVE.value for u in users]):
        raise AdminException("No active admin. Please update 'is_active' in db manually.", 500)
    else:
        default_admin_rows = [u for u in users if u.email == "admin@ragflow.io"]
        if default_admin_rows:
            default_admin = default_admin_rows[0].to_dict()
            exist, default_admin_tenant = TenantService.get_by_id(default_admin["id"])
            if not exist:
                add_tenant_for_admin(default_admin, UserTenantRole.OWNER)


def add_tenant_for_admin(user_info: dict, role: str):

    tenant = {
        "id": user_info["id"],
        "name": user_info["nickname"] + "‘s Kingdom",
        "llm_id": settings.CHAT_MDL,
        "embd_id": settings.EMBEDDING_MDL,
        "asr_id": settings.ASR_MDL,
        "parser_ids": settings.PARSERS,
        "img2txt_id": settings.VISION_MDL,
        "rerank_id": settings.RERANK_MDL,
    }
    usr_tenant = {"tenant_id": user_info["id"], "user_id": user_info["id"], "invited_by": user_info["id"], "role": role}

    # tenant_llm = get_init_tenant_llm(user_info["id"])
    TenantService.insert(**tenant)
    UserTenantService.insert(**usr_tenant)
    # TenantLLMService.insert_many(tenant_llm)
    logging.info(f"Added tenant for email: {user_info['email']}, A default tenant has been set; changing the default models after login is strongly recommended.")


def check_admin_auth(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        user = UserService.filter_by_id(current_user.id)
        if not user:
            raise UserNotFoundError(current_user.email)
        if not user.is_superuser:
            raise AdminException("Not admin", 403)
        if user.is_active == ActiveEnum.INACTIVE.value:
            raise AdminException(f"User {current_user.email} inactive", 403)

        return func(*args, **kwargs)

    return wrapper


def login_admin(email: str, password: str):
    """
    :param email: admin email
    :param password: string before decrypt (RSA encrypted + base64 encoded)
    """
    users = UserService.query(email=email)
    if not users:
        raise UserNotFoundError(email)
    decrypted = decrypt(password)
    user = UserService.query_user(email, decrypted)
    if not user:
        raise AdminException("Email and password do not match!")
    if not user.is_superuser:
        raise AdminException("Not admin", 403)
    if user.is_active == ActiveEnum.INACTIVE.value:
        raise AdminException(f"User {email} inactive", 403)

    resp = user.to_json()
    user.access_token = generate_access_token(user.id)
    login_user(user)
    user.update_time = (current_timestamp(),)
    user.update_date = (datetime_format(datetime.now()),)
    user.last_login_time = get_format_time()
    user.save()
    msg = "Welcome back!"
    return sync_construct_response(data=resp, auth=user.get_id(), message=msg)


def check_admin(username: str, password: str):
    users = UserService.query(email=username)
    if not users:
        logging.info(f"Username: {username} is not registered!")
        user_info = {
            "id": uuid.uuid1().hex,
            "password": encode_to_base64("admin"),
            "nickname": "admin",
            "is_superuser": True,
            "email": "admin@ragflow.io",
            "creator": "system",
            "status": "1",
        }
        if not UserService.save(**user_info):
            raise AdminException("Can't init admin.", 500)

    user = UserService.query_user(username, password)
    if user:
        return True
    else:
        return False


def login_verify(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth = request.authorization
        if not auth or "username" not in auth.parameters or "password" not in auth.parameters:
            return jsonify({"code": 401, "message": "Authentication required", "data": None}), 200

        username = auth.parameters["username"]
        password = auth.parameters["password"]
        try:
            if not check_admin(username, password):
                return jsonify({"code": 500, "message": "Access denied", "data": None}), 200
        except Exception:
            logging.exception("An error occurred during admin login verification.")
            return jsonify({"code": 500, "message": "An internal server error occurred."}), 200

        return f(*args, **kwargs)

    return decorated
