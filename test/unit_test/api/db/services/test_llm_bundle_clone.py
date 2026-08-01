import threading
from copy import deepcopy
from types import SimpleNamespace

import pytest

from api.db.services.llm_service import LLMBundle


def test_clone_rebuilds_bundle_without_copying_live_client(monkeypatch):
    bundle = object.__new__(LLMBundle)
    bundle.tenant_id = "tenant-1"
    bundle.model_config = {"llm_name": "chat-model", "model_type": "chat"}
    bundle.lang = "Chinese"
    bundle.trace_context = {"trace_id": "trace-1"}
    bundle.langfuse_session_id = "session-1"
    bundle._model_kwargs = {"max_retries": 2}
    bundle.mdl = SimpleNamespace(lock=threading.RLock())

    with pytest.raises(TypeError, match="RLock"):
        deepcopy(bundle)

    captured = {}

    def fake_init(self, tenant_id, model_config, lang="Chinese", **kwargs):
        captured.update(tenant_id=tenant_id, model_config=model_config, lang=lang, kwargs=kwargs)

    monkeypatch.setattr(LLMBundle, "__init__", fake_init)

    cloned = bundle.clone()

    assert isinstance(cloned, LLMBundle)
    assert captured == {
        "tenant_id": "tenant-1",
        "model_config": bundle.model_config,
        "lang": "Chinese",
        "kwargs": {
            "max_retries": 2,
            "trace_context": {"trace_id": "trace-1"},
            "langfuse_session_id": "session-1",
        },
    }
    assert captured["model_config"] is not bundle.model_config
    assert captured["kwargs"]["trace_context"] is not bundle.trace_context
