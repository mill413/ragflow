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

import os
import urllib.parse

from common.http_client import async_request, sync_request


class UserInfo:
    def __init__(self, email, username, nickname, avatar_url):
        self.email = email
        self.username = username
        self.nickname = nickname
        self.avatar_url = avatar_url

    def to_dict(self):
        return {key: value for key, value in self.__dict__.items()}


class OAuthClient:
    def __init__(self, config):
        """
        Initialize the OAuthClient with the provider's configuration.
        """
        self.client_id = config["client_id"]
        self.client_secret = config.get("client_secret", "")
        if client_secret_env := config.get("client_secret_env"):
            self.client_secret = os.environ.get(client_secret_env, self.client_secret)
        if not self.client_secret:
            raise ValueError("OAuth client secret is not configured")
        self.authorization_url = config["authorization_url"]
        self.token_url = config["token_url"]
        self.userinfo_url = config["userinfo_url"]
        self.redirect_uri = config["redirect_uri"]
        self.scope = config.get("scope", None)
        self.userinfo_client_id_header = config.get("userinfo_client_id_header")

        self.http_request_timeout = int(config.get("request_timeout", 7))

    def get_authorization_url(self, state=None):
        """
        Generate the authorization URL for user login.
        """
        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
        }
        if self.scope:
            params["scope"] = self.scope
        if state:
            params["state"] = state
        authorization_url = f"{self.authorization_url}?{urllib.parse.urlencode(params)}"
        return authorization_url

    def exchange_code_for_token(self, code):
        """
        Exchange authorization code for access token.
        """
        try:
            payload = {"client_id": self.client_id, "client_secret": self.client_secret, "code": code, "redirect_uri": self.redirect_uri, "grant_type": "authorization_code"}
            response = sync_request(
                "POST",
                self.token_url,
                data=payload,
                headers={"Accept": "application/json"},
                timeout=self.http_request_timeout,
            )
            response.raise_for_status()
            return self.normalize_token_info(response.json())
        except Exception as e:
            raise ValueError(f"Failed to exchange authorization code for token: {e}")

    async def async_exchange_code_for_token(self, code):
        """
        Async variant of exchange_code_for_token using httpx.
        """
        payload = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "code": code,
            "redirect_uri": self.redirect_uri,
            "grant_type": "authorization_code",
        }
        try:
            response = await async_request(
                "POST",
                self.token_url,
                data=payload,
                headers={"Accept": "application/json"},
                timeout=self.http_request_timeout,
            )
            response.raise_for_status()
            return self.normalize_token_info(response.json())
        except Exception as e:
            raise ValueError(f"Failed to exchange authorization code for token: {e}")

    def fetch_user_info(self, access_token, **kwargs):
        """
        Fetch user information using access token.
        """
        try:
            headers = self.build_userinfo_headers(access_token)
            response = sync_request("GET", self.userinfo_url, headers=headers, timeout=self.http_request_timeout)
            response.raise_for_status()
            user_info = response.json()
            return self.normalize_user_info(user_info)
        except Exception as e:
            raise ValueError(f"Failed to fetch user info: {e}")

    async def async_fetch_user_info(self, access_token, **kwargs):
        """Async variant of fetch_user_info using httpx."""
        headers = self.build_userinfo_headers(access_token)
        try:
            response = await async_request(
                "GET",
                self.userinfo_url,
                headers=headers,
                timeout=self.http_request_timeout,
            )
            response.raise_for_status()
            user_info = response.json()
            return self.normalize_user_info(user_info)
        except Exception as e:
            raise ValueError(f"Failed to fetch user info: {e}")

    def normalize_token_info(self, token_info):
        if not isinstance(token_info, dict):
            raise TypeError("OAuth token response must be a JSON object")
        if token_info.get("access_token"):
            return token_info

        data = token_info.get("data")
        if not isinstance(data, dict):
            raise ValueError("OAuth token response does not contain an access token")

        value = data.get("value")
        if isinstance(value, str) and value:
            return {**token_info, "access_token": value}
        if isinstance(value, dict):
            access_token = value.get("access_token") or value.get("token") or value.get("value")
            if access_token:
                return {**token_info, "access_token": access_token}

        raise ValueError("OAuth token response does not contain an access token")

    def build_userinfo_headers(self, access_token):
        headers = {"Authorization": f"Bearer {access_token}"}
        if self.userinfo_client_id_header:
            headers[str(self.userinfo_client_id_header)] = self.client_id
        return headers

    def normalize_user_info(self, user_info):
        if not isinstance(user_info, dict):
            raise TypeError("OAuth user info response must be a JSON object")
        data = user_info.get("data", user_info)
        if not isinstance(data, dict):
            raise TypeError("OAuth user info response data must be a JSON object")

        email = data.get("email")
        username = data.get("username") or data.get("userName") or data.get("account") or str(email).split("@")[0]
        nickname = data.get("nickname") or data.get("nickName") or data.get("name") or data.get("realName") or username
        avatar_url = data.get("avatar_url") or data.get("avatarUrl") or data.get("avatar") or data.get("picture") or ""
        return UserInfo(email=email, username=username, nickname=nickname, avatar_url=avatar_url)
