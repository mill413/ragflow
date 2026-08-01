import sys
from pathlib import Path

from flask import Blueprint, Flask


ADMIN_SERVER_DIR = Path(__file__).resolve().parents[3] / "admin" / "server"
sys.path.insert(0, str(ADMIN_SERVER_DIR))

from openapi import build_admin_openapi_spec  # noqa: E402


def test_openapi_spec_is_generated_from_registered_admin_routes():
    app = Flask(__name__)
    blueprint = Blueprint("admin_test", __name__, url_prefix="/api/v1/admin")

    @blueprint.get("/ping")
    def ping():
        return {}

    @blueprint.patch("/users/<username>")
    def update_user(username):
        return {"username": username}

    app.register_blueprint(blueprint)

    spec = build_admin_openapi_spec(app)

    assert spec["openapi"] == "3.1.0"
    assert spec["paths"]["/api/v1/admin/ping"]["get"].get("security") is None
    operation = spec["paths"]["/api/v1/admin/users/{username}"]["patch"]
    assert operation["summary"] == "修改用户信息"
    assert operation["security"] == [{"adminBearer": []}]
    assert operation["parameters"] == [
        {
            "name": "username",
            "in": "path",
            "required": True,
            "schema": {"type": "string"},
        }
    ]
    assert operation["requestBody"]["content"]["application/json"]["schema"] == {
        "$ref": "#/components/schemas/UserUpdateRequest"
    }


def test_openapi_spec_documents_resource_filters():
    app = Flask(__name__)
    blueprint = Blueprint("admin_resource_test", __name__, url_prefix="/api/v1/admin")

    @blueprint.get("/resources")
    def list_resources():
        return {}

    app.register_blueprint(blueprint)

    operation = build_admin_openapi_spec(app)["paths"]["/api/v1/admin/resources"]["get"]
    query_names = {
        parameter["name"]
        for parameter in operation["parameters"]
        if parameter["in"] == "query"
    }

    assert query_names == {
        "type",
        "page",
        "page_size",
        "keywords",
        "workspace_ids",
        "hierarchy",
    }


def test_openapi_spec_uses_one_bearer_authentication_flow():
    app = Flask(__name__)
    blueprint = Blueprint("admin_auth_test", __name__, url_prefix="/api/v1/admin")

    @blueprint.get("/auth")
    def auth_admin():
        return {}

    @blueprint.get("/users")
    def list_users():
        return {}

    app.register_blueprint(blueprint)

    spec = build_admin_openapi_spec(app)

    assert "/api/v1/admin/auth" not in spec["paths"]
    assert spec["paths"]["/api/v1/admin/users"]["get"]["security"] == [
        {"adminBearer": []}
    ]
    assert set(spec["components"]["securitySchemes"]) == {"adminBearer"}
