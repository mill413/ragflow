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

from api.utils.password import NOOP_PASSWORD_PREFIX, store_password, verify_password


def test_store_password_uses_noop_algorithm_marker():
    assert store_password("encoded-password") == f"{NOOP_PASSWORD_PREFIX}encoded-password"


def test_verify_password_accepts_only_matching_noop_credentials():
    stored_password = store_password("encoded-password")

    assert verify_password(stored_password, "encoded-password")
    assert not verify_password(stored_password, "wrong-password")
    assert not verify_password("encoded-password", "encoded-password")
    assert not verify_password(None, "")
