import os
import sys
from pathlib import Path

EXECUTOR_MANAGER_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EXECUTOR_MANAGER_ROOT))

os.environ["SANDBOX_RUN_RATE_LIMIT"] = "3/minute"
os.environ["SANDBOX_RUN_PREAUTH_RATE_LIMIT"] = "1000/minute"

import pytest
from services.limiter import limiter
from services.preauth import preauth_limiter


@pytest.fixture(autouse=True)
def _reset_rate_limiters(monkeypatch):
    limiter.reset()
    preauth_limiter.reset()
    monkeypatch.delenv("SANDBOX_EXECUTOR_MANAGER_API_TOKEN", raising=False)
    monkeypatch.delenv("SANDBOX_EXECUTOR_MANAGER_ALLOW_UNAUTHENTICATED", raising=False)
    yield
    preauth_limiter.reset()
    limiter.reset()
