import pytest

from api.apps.services import provider_api_service


@pytest.mark.asyncio
async def test_openai_compatible_instance_can_be_saved_before_models_are_added(
    monkeypatch,
):
    monkeypatch.setattr(
        provider_api_service.TenantModelProviderService,
        "get_by_id",
        lambda *_args, **_kwargs: (False, None),
    )
    monkeypatch.setattr(
        provider_api_service,
        "FACTORY_LLM_INFOS",
        [{"name": "OpenAI-API-Compatible", "llm": [], "url": ""}],
    )

    success, message, verification = await provider_api_service.verify_api_key(
        "OpenAI-API-Compatible",
        "secret",
        "http://model-service.internal/v1",
        model_info=[],
    )

    assert success is True
    assert message == "No model configured; connectivity verification skipped"
    assert verification == {}


@pytest.mark.asyncio
async def test_model_verification_reports_30_second_timeout(monkeypatch):
    captured = {}

    class FakeChatModel:
        def __init__(self, *_args, **_kwargs):
            pass

        async def async_chat_streamly(self, *_args, **_kwargs):
            if False:
                yield ""

    async def timeout(awaitable, timeout):
        captured["timeout"] = timeout
        awaitable.close()
        raise TimeoutError

    monkeypatch.setattr(
        provider_api_service.TenantModelProviderService,
        "get_by_id",
        lambda *_args, **_kwargs: (False, None),
    )
    monkeypatch.setattr(
        provider_api_service,
        "FACTORY_LLM_INFOS",
        [{"name": "OpenAI-API-Compatible", "llm": [], "url": ""}],
    )
    monkeypatch.setitem(
        provider_api_service.ChatModel,
        "OpenAI-API-Compatible",
        FakeChatModel,
    )
    monkeypatch.setattr(provider_api_service.asyncio, "wait_for", timeout)

    success, message, verification = await provider_api_service.verify_api_key(
        "OpenAI-API-Compatible",
        "secret",
        "http://model-service.internal/v1",
        model_info=[
            {
                "model_name": "chat-model",
                "model_type": ["chat"],
            }
        ],
    )

    assert success is False
    assert captured["timeout"] == 30
    assert "timed out after 30 seconds" in message
    assert verification["chat-model"] == provider_api_service.ModelVerifyStatusEnum.FAIL.value
