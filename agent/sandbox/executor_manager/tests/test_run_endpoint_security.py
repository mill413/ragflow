import asyncio
import base64

import pytest
from fastapi.testclient import TestClient
from models.enums import ResultStatus, SupportLanguage
from models.schemas import CodeExecutionResult

TOKEN_ENV = "SANDBOX_EXECUTOR_MANAGER_API_TOKEN"
ALLOW_ENV = "SANDBOX_EXECUTOR_MANAGER_ALLOW_UNAUTHENTICATED"
TEST_TOKEN = "unit-test-shared-secret"


def _payload():
    code = "def main():\n    return 42\n"
    return {"code_b64": base64.b64encode(code.encode()).decode(), "language": "python", "arguments": {}}


@pytest.fixture()
def client(monkeypatch):
    async def fake_execute_code(_req):
        return CodeExecutionResult(status=ResultStatus.SUCCESS, stdout="42", stderr="", exit_code=0)

    monkeypatch.setattr("api.handlers.execute_code", fake_execute_code)
    from core import container

    container._CONTAINER_EXECUTION_SEMAPHORES[SupportLanguage.PYTHON] = asyncio.Semaphore(1)
    container._CONTAINER_EXECUTION_SEMAPHORES[SupportLanguage.NODEJS] = asyncio.Semaphore(1)
    import main

    return TestClient(main.app)


def test_run_fails_closed_without_token(client):
    assert client.post("/run", json=_payload()).status_code == 503


def test_run_rejects_wrong_and_accepts_correct_token(client, monkeypatch):
    monkeypatch.setenv(TOKEN_ENV, TEST_TOKEN)
    assert client.post("/run", json=_payload(), headers={"Authorization": "Bearer wrong"}).status_code == 401
    response = client.post("/run", json=_payload(), headers={"Authorization": f"Bearer {TEST_TOKEN}"})
    assert response.status_code == 200


def test_explicit_insecure_opt_in_is_required(client, monkeypatch):
    monkeypatch.setenv(ALLOW_ENV, "true")
    assert client.post("/run", json=_payload()).status_code == 200


def test_health_check_remains_public(client, monkeypatch):
    monkeypatch.setenv(TOKEN_ENV, TEST_TOKEN)
    assert client.get("/healthz").status_code == 200


def test_container_network_defaults_to_none(monkeypatch):
    calls = []

    async def fake_run_command(*args, **_kwargs):
        calls.append(list(args))
        return 0, "true", ""

    from core import container

    monkeypatch.delenv("SANDBOX_CONTAINER_NETWORK", raising=False)
    monkeypatch.setattr(container, "async_run_command", fake_run_command)
    assert asyncio.run(container.create_container("sandbox_python_0", SupportLanguage.PYTHON)) is True
    docker_run = next(args for args in calls if args[:3] == ["docker", "run", "-d"])
    assert docker_run[docker_run.index("--network") + 1] == "none"
