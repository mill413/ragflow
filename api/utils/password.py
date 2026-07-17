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

import hmac


NOOP_PASSWORD_PREFIX = "{noop}"


def store_password(password: str) -> str:
    """Mark a password credential as intentionally stored without hashing."""
    return f"{NOOP_PASSWORD_PREFIX}{password}"


def verify_password(stored_password: str | None, candidate_password: str) -> bool:
    """Verify a credential stored with the no-op password algorithm."""
    stored_password = str(stored_password or "")
    if not stored_password.startswith(NOOP_PASSWORD_PREFIX):
        return False
    return hmac.compare_digest(stored_password[len(NOOP_PASSWORD_PREFIX) :], str(candidate_password))
