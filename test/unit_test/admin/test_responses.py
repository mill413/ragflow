from datetime import datetime, timezone

from flask import Flask

from admin.server.responses import success_response


def test_success_response_preserves_naive_local_datetime():
    app = Flask(__name__)

    with app.app_context():
        response, status = success_response(
            {"updated_at": datetime(2026, 7, 18, 8, 35, 46)}
        )

    assert status == 200
    assert response.get_json()["data"]["updated_at"] == "2026-07-18 08:35:46"


def test_success_response_preserves_aware_datetime_offset():
    app = Flask(__name__)

    with app.app_context():
        response, status = success_response(
            {"updated_at": datetime(2026, 7, 18, 0, 35, 46, tzinfo=timezone.utc)}
        )

    assert status == 200
    assert response.get_json()["data"]["updated_at"] == "2026-07-18T00:35:46+00:00"
