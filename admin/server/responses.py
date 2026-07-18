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
from datetime import date, datetime

from flask import jsonify


def _serialize_dates(value):
    if isinstance(value, datetime):
        return value.isoformat(sep=" " if value.tzinfo is None else "T")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: _serialize_dates(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_serialize_dates(item) for item in value]
    return value


def success_response(data=None, message="Success", code=0):
    return jsonify({"code": code, "message": message, "data": _serialize_dates(data)}), 200


def error_response(message="Error", code=-1, data=None):
    return jsonify({"code": code, "message": message, "data": _serialize_dates(data)}), 400
