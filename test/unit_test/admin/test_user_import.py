import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[3] / "admin" / "server"))

import services
from api.common.exceptions import AdminException, UserAlreadyExistsError
from services import OrganizationMgr, UserMgr


@pytest.fixture
def department_data(monkeypatch):
    data = {
        "departments": [
            {
                "id": "headquarters",
                "name": "总部",
                "parent_id": None,
                "path": "总部",
            },
            {
                "id": "engineering",
                "name": "研发部",
                "parent_id": "headquarters",
                "path": "总部/研发部",
            },
        ],
        "user_departments": {},
        "user_metadata": {},
    }
    monkeypatch.setattr(
        OrganizationMgr,
        "_load",
        lambda: data,
    )
    monkeypatch.setattr(
        OrganizationMgr,
        "_save",
        lambda updated: data.update(updated),
    )
    return data


def test_ensure_department_path_reuses_existing_hierarchy(department_data):
    assert (
        OrganizationMgr.ensure_department_path("总部/研发部") == "engineering"
    )
    assert len(department_data["departments"]) == 2
    assert OrganizationMgr.ensure_department_path("") is None


def test_ensure_department_path_creates_missing_levels(department_data):
    department_id = OrganizationMgr.ensure_department_path(
        "总部/研发部/平台组"
    )

    created = next(
        department
        for department in department_data["departments"]
        if department["id"] == department_id
    )
    assert created["name"] == "平台组"
    assert created["parent_id"] == "engineering"
    assert created["path"] == "总部/研发部/平台组"


def test_ensure_department_path_rejects_empty_segments(department_data):
    with pytest.raises(AdminException, match="Invalid department path"):
        OrganizationMgr.ensure_department_path("总部//平台组")


def test_import_users_returns_row_level_results(monkeypatch):
    created = []
    departments = []

    monkeypatch.setattr(
        OrganizationMgr,
        "ensure_department_path",
        lambda path: "department-1" if path else None,
    )
    monkeypatch.setattr(
        OrganizationMgr,
        "set_user_department",
        lambda user_id, department_id: departments.append(
            (user_id, department_id)
        ),
    )

    def build_user_info(email, nickname, password):
        if email == "existing@example.com":
            raise UserAlreadyExistsError(email)
        created.append((email, nickname, password))
        return {
            "email": email,
            "nickname": nickname,
            "password": password,
        }

    monkeypatch.setattr(UserMgr, "_build_new_user_info", build_user_info)
    monkeypatch.setattr(
        services,
        "create_new_user",
        lambda user_info: {
            "success": True,
            "user_info": {**user_info, "id": f"id-{len(created)}"},
        },
    )

    result = UserMgr.import_users(
        [
            {
                "email": "new@example.com",
                "nickname": "New",
                "password": "encrypted",
                "department_path": "总部/研发部",
            },
            {"email": "missing-password@example.com"},
            {"email": "existing@example.com", "password": "encrypted"},
        ]
    )

    assert result == {
        "total": 3,
        "created": 1,
        "failed": 2,
        "errors": [
            {
                "row": 3,
                "email": "missing-password@example.com",
                "message": "Password is required",
            },
            {
                "row": 4,
                "email": "existing@example.com",
                "message": "User 'existing@example.com' already exists",
            },
        ],
    }
    assert created == [("new@example.com", "New", "encrypted")]
    assert departments == [("id-1", "department-1")]
