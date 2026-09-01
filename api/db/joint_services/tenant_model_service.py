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
import enum
import json
import logging
import os

from api.db.services.shared_model_service import SharedModelService
from api.db.services.tenant_llm_service import TenantService
from api.db.services.tenant_model_instance_service import TenantModelInstanceService
from api.db.services.tenant_model_provider_service import TenantModelProviderService
from api.db.services.tenant_model_service import TenantModelService
from api.utils.model_utils import calculate_model_type, get_model_type_human
from common import settings
from common.constants import (
    MINERU_DEFAULT_CONFIG,
    MINERU_ENV_KEYS,
    OPENDATALOADER_DEFAULT_CONFIG,
    OPENDATALOADER_ENV_KEYS,
    PADDLEOCR_DEFAULT_CONFIG,
    PADDLEOCR_ENV_KEYS,
    SOMARK_DEFAULT_CONFIG,
    SOMARK_ENV_KEYS,
    ActiveStatusEnum,
    LLMType,
    ModelTypeBinary,
)

logger = logging.getLogger(__name__)


def _factory_model_types(llm: dict) -> list[str]:
    model_type = llm.get("model_type")
    if isinstance(model_type, list):
        return model_type
    return [model_type] if model_type else []


def _lookup_factory_llm_info(provider_name: str, pure_model_name: str, extra_fields: dict) -> dict | None:
    region = extra_fields.get("region", "default")
    if region == "intl" and provider_name.lower() == "siliconflow":
        target_factory_name = "siliconflow_intl"
    else:
        target_factory_name = provider_name
    fac_list = [f for f in settings.FACTORY_LLM_INFOS if f["name"] == target_factory_name]
    if not fac_list:
        return None
    llm_list = [llm for llm in fac_list[0]["llm"] if llm["llm_name"] == pure_model_name]
    return llm_list[0] if llm_list else None


def _decode_api_key_config(raw_api_key: str) -> tuple[str, bool | None, str | None]:
    if not raw_api_key:
        return raw_api_key, None, None

    try:
        parsed = json.loads(raw_api_key)
    except Exception:
        return raw_api_key, None, None

    if not isinstance(parsed, dict):
        return raw_api_key, None, None

    is_tools = bool(parsed["is_tools"]) if "is_tools" in parsed else None
    if set(parsed.keys()) <= {"api_key", "is_tools"}:
        return parsed.get("api_key", ""), is_tools, None

    return parsed.get("api_key", raw_api_key), is_tools, raw_api_key


def get_first_provider_model_name(tenant_id: str, provider_name: str, model_type: str | enum.Enum) -> str | None:
    model_type_bin = calculate_model_type(model_type)
    provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)
    if not provider_obj:
        return None

    for instance_obj in TenantModelInstanceService.get_all_by_provider_id(provider_obj.id):
        if instance_obj.status != ActiveStatusEnum.ACTIVE.value:
            continue
        for model_obj in TenantModelService.get_models_by_instance_id(instance_obj.id):
            if model_obj.model_type & model_type_bin and model_obj.status == ActiveStatusEnum.ACTIVE.value:
                return f"{model_obj.model_name}@{instance_obj.instance_name}@{provider_name}"
    return None


def _collect_env_config(env_keys: list[str], default_config: dict) -> dict | None:
    config = dict(default_config)
    found = False
    for key in env_keys:
        value = os.environ.get(key)
        if value:
            found = True
            config[key] = value
    return config if found else None


def _ensure_ocr_provider_from_env(tenant_id: str, provider_name: str, model_name: str, config: dict | None) -> str | None:
    if not config:
        return None

    provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)
    if not provider_obj:
        TenantModelProviderService.insert(tenant_id=tenant_id, provider_name=provider_name)
        provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)

    api_key = json.dumps(config)
    instance_obj = TenantModelInstanceService.get_by_provider_id_and_api_key(provider_obj.id, api_key)
    if not instance_obj:
        instance_obj = TenantModelInstanceService.create_instance(
            provider_id=provider_obj.id,
            instance_name=model_name,
            api_key=api_key,
            extra="{}",
        )

    model_obj = TenantModelService.get_by_provider_id_and_instance_id_and_model_type_and_model_name(
        provider_obj.id,
        instance_obj.id,
        LLMType.OCR.value,
        model_name,
    )
    if not model_obj:
        TenantModelService.insert(
            model_name=model_name,
            provider_id=provider_obj.id,
            instance_id=instance_obj.id,
            model_type=ModelTypeBinary.OCR.value,
            extra=json.dumps({"max_tokens": 0}),
        )

    return f"{model_name}@{instance_obj.instance_name}@{provider_name}"


def ensure_mineru_from_env(tenant_id: str) -> str | None:
    return _ensure_ocr_provider_from_env(
        tenant_id,
        "MinerU",
        "mineru-from-env",
        _collect_env_config(MINERU_ENV_KEYS, MINERU_DEFAULT_CONFIG),
    )


def ensure_paddleocr_from_env(tenant_id: str) -> str | None:
    return _ensure_ocr_provider_from_env(
        tenant_id,
        "PaddleOCR",
        "paddleocr-from-env",
        _collect_env_config(PADDLEOCR_ENV_KEYS, PADDLEOCR_DEFAULT_CONFIG),
    )


def get_tenant_default_model_by_type(tenant_id: str, model_type: str | enum.Enum):
    exist, tenant = TenantService.get_by_id(tenant_id)
    if not exist:
        raise LookupError("Tenant not found")
    model_type_val = model_type if isinstance(model_type, str) else model_type.value
    model_id: str | None = None
    model_name: str = ""
    match model_type_val:
        case LLMType.EMBEDDING.value:
            model_id = tenant.tenant_embd_id
            model_name = tenant.embd_id
        case LLMType.ASR.value:
            model_id = tenant.tenant_asr_id
            model_name = tenant.asr_id
        case LLMType.VISION.value:
            model_id = tenant.tenant_img2txt_id
            model_name = tenant.img2txt_id
        case LLMType.CHAT.value:
            model_id = tenant.tenant_llm_id
            model_name = tenant.llm_id
        case LLMType.RERANK.value:
            model_id = tenant.tenant_rerank_id
            model_name = tenant.rerank_id
        case LLMType.TTS.value:
            model_id = tenant.tenant_tts_id
            model_name = tenant.tts_id
        case LLMType.OCR.value:
            raise Exception("OCR model name is required")
        case _:
            raise Exception(f"Unknown model type {model_type}")
    if not model_name:
        raise Exception(f"No default {model_type} model is set.")
    # Prefer resolving by tenant_model.id when available
    if model_id:
        try:
            return get_model_config_by_id(tenant_id, model_type, model_id)
        except LookupError:
            logger.warning("tenant_model id=%s not found, falling back to model_name lookup for %s", model_id, model_name)
    return resolve_model_config(tenant_id, model_type, model_name)


def split_model_name(model_name: str):
    # Parse model_name: {model_name} or {model_name}@{factory_name} or {model_name}@{instance_name}@{factory_name}
    #
    # The composite key is right-anchored on the provider: the *last* '@'-separated
    # field is the factory/provider, the second-to-last is the instance (when
    # present), and everything to the left is the bare model name. Some model
    # names legitimately contain '@' characters themselves (e.g. LM Studio
    # embedding model IDs such as `text-embedding-nomic-embed-text-v1.5@q8_0`),
    # which produces composite keys like
    # `text-embedding-nomic-embed-text-v1.5@q8_0@lmstudio@LM-Studio`.
    # Use rsplit with maxsplit=2 from the right so any '@' characters embedded
    # in the leftmost model-name component are preserved as part of that name.
    parts = model_name.rsplit("@", 2)
    n = len(parts)
    if n == 3:
        pure_model_name, instance_name, provider_name = parts
    elif n == 2:
        pure_model_name, provider_name = parts
        instance_name = "default"
    else:
        pure_model_name = parts[0]
        provider_name = ""
        instance_name = ""
    return pure_model_name, instance_name, provider_name


def _resolve_instance_for_model(provider_obj, instance_name: str, model_name: str):
    instance_obj = TenantModelInstanceService.get_by_provider_id_and_instance_name(provider_obj.id, instance_name)
    if instance_obj:
        return instance_obj
    if instance_name != "default":
        raise LookupError(f"Instance {instance_name} not found for model {model_name}.")

    active_instances = [inst for inst in TenantModelInstanceService.get_all_by_provider_id(provider_obj.id) if inst.status == ActiveStatusEnum.ACTIVE.value]
    if len(active_instances) == 1:
        logger.warning(
            "Model instance fallback applied for legacy default instance name",
            extra={
                "provider_name": provider_obj.provider_name,
                "requested_instance_name": instance_name,
                "resolved_instance_name": active_instances[0].instance_name,
                "model_name": model_name,
            },
        )
        return active_instances[0]

    raise LookupError(f"Instance {instance_name} not found for model {model_name}.")


def _resolve_shared_model_by_name(tenant_id: str, model_name: str, model_type: str | enum.Enum | None = None):
    pure_model_name, instance_name, provider_name = split_model_name(model_name)
    model_type_val = model_type if isinstance(model_type, str) or model_type is None else model_type.value
    model_type_bin = calculate_model_type(model_type_val) if model_type_val else None
    matches = []
    for model_obj in TenantModelService.get_models_by_ids(SharedModelService.list_accessible_model_ids(tenant_id)):
        if model_obj.model_name != pure_model_name or model_obj.status != ActiveStatusEnum.ACTIVE.value:
            continue
        if model_type_bin and not (model_obj.model_type & model_type_bin):
            continue
        ok, provider_obj = TenantModelProviderService.get_by_id(model_obj.provider_id)
        if not ok or provider_obj.provider_name != provider_name:
            continue
        ok, instance_obj = TenantModelInstanceService.get_by_id(model_obj.instance_id)
        if not ok or instance_obj.instance_name != instance_name:
            continue
        matches.append(model_obj)
    if len(matches) > 1:
        raise LookupError(f"Multiple shared models match {model_name}; use the model id instead.")
    return matches[0] if matches else None


def resolve_model_config(tenant_id, model_type: str | enum.Enum, model_ref: str):
    exists, _ = TenantModelService.get_by_id(model_ref)
    if exists:
        return get_model_config_by_id(tenant_id, model_type, model_ref)
    return get_model_config_from_provider_instance(tenant_id, model_type, model_ref)


def resolve_model_config_with_fallback(
    tenant_id,
    model_type: str | enum.Enum,
    model_ref: str,
    fallback_model_ref: str | None,
):
    """Resolve a configured model reference, falling back after stale lookups.

    Parser configurations created before tenant model IDs were introduced can
    retain a ``model@instance@provider`` reference after that instance is
    renamed or removed.  Task records also contain the tenant's current stable
    model ID, so use it when the legacy lookup is no longer valid.  Only lookup
    failures trigger the fallback; configuration and runtime errors still
    propagate unchanged.
    """
    try:
        return resolve_model_config(tenant_id, model_type, model_ref)
    except LookupError:
        if not fallback_model_ref or fallback_model_ref == model_ref:
            raise
        logger.warning(
            "Model reference %s is no longer valid for tenant %s; falling back to model id %s",
            model_ref,
            tenant_id,
            fallback_model_ref,
        )
        return resolve_model_config(tenant_id, model_type, fallback_model_ref)


def get_model_config_from_provider_instance(tenant_id, model_type: str | enum.Enum, model_name: str):
    pure_model_name, instance_name, provider_name = split_model_name(model_name)
    model_type_val = model_type if isinstance(model_type, str) else model_type.value
    # Builtin embedding model
    compose_profiles = os.getenv("COMPOSE_PROFILES", "")
    is_tei_builtin_embedding = (
        model_type_val == LLMType.EMBEDDING.value and "tei-" in compose_profiles and pure_model_name == os.getenv("TEI_MODEL", "") and (provider_name == "Builtin" or not provider_name)
    )
    if is_tei_builtin_embedding:
        # configured local embedding model
        embedding_cfg = settings.EMBEDDING_CFG
        return {
            "llm_factory": "Builtin",
            "api_key": embedding_cfg["api_key"],
            "llm_name": pure_model_name,
            "api_base": embedding_cfg["base_url"],
            "model_type": LLMType.EMBEDDING.value,
        }

    provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)
    if not provider_obj:
        shared_model = _resolve_shared_model_by_name(tenant_id, model_name, model_type_val)
        if shared_model:
            return get_model_config_by_id(tenant_id, model_type_val, shared_model.id)
        raise LookupError(f"Provider {provider_name} not found for model {model_name}.")
    instance_obj = _resolve_instance_for_model(provider_obj, instance_name, model_name)
    model_obj = TenantModelService.get_by_provider_id_and_instance_id_and_model_type_and_model_name(provider_obj.id, instance_obj.id, model_type_val, pure_model_name)

    api_key, is_tool, api_key_payload = _decode_api_key_config(instance_obj.api_key)
    extra_fields = json.loads(instance_obj.extra) if instance_obj.extra else {}

    if model_obj:
        if model_obj.status == ActiveStatusEnum.INACTIVE.value:
            raise LookupError(f"Model {model_name} is disabled.")
        if model_obj.status == ActiveStatusEnum.UNSUPPORTED.value:
            raise LookupError(f"Model {model_name} cannot be used as {model_type_val} model.")

        model_extra = json.loads(model_obj.extra) if model_obj.extra else {}
        llm_info = _lookup_factory_llm_info(provider_obj.provider_name, pure_model_name, extra_fields)
        if "max_tokens" in model_extra:
            max_tokens = model_extra["max_tokens"]
        else:
            max_tokens = (llm_info or {}).get("max_tokens", 8192)
        model_config = {
            "llm_factory": provider_obj.provider_name,
            "api_key": api_key,
            "llm_name": model_obj.model_name,
            "api_base": extra_fields.get("base_url", ""),
            "model_type": model_type_val,
            "is_tools": model_extra.get("is_tools", is_tool),
            "max_tokens": max_tokens,
        }
        if provider_name.lower() == "somark":
            # SoMark/OCR factories read parser config (somark_*, parse_method, ...)
            # from model_config["extra"]; see tenant_llm_service.LLMBundle OCR path.
            model_config["extra"] = model_extra

        if api_key_payload is not None:
            model_config["api_key_payload"] = api_key_payload

        return model_config
    else:
        raise LookupError(f"Model {model_name} not found for model {model_type_val}")


def get_model_config_by_id(tenant_id: str, model_type: str | enum.Enum, model_id: str):
    """Get model config from tenant_model by its id (CharField PK)."""
    model_type_val = model_type if isinstance(model_type, str) else model_type.value
    model_type_bin = calculate_model_type(model_type_val)
    exist, model_obj = TenantModelService.get_by_id(model_id)
    if not exist:
        raise LookupError(f"TenantModel id={model_id} not found.")
    if model_obj.status == ActiveStatusEnum.INACTIVE.value:
        raise LookupError(f"TenantModel id={model_id} is disabled.")
    if model_obj.status == ActiveStatusEnum.UNSUPPORTED.value:
        raise LookupError(f"TenantModel id={model_id} cannot be used as {model_type_val} model.")
    if not (model_obj.model_type & model_type_bin):
        raise LookupError(f"TenantModel id={model_id} cannot be used as {model_type_val} model.")

    ok, provider_obj = TenantModelProviderService.get_by_id(model_obj.provider_id)
    if not ok:
        raise LookupError(f"Provider id={model_obj.provider_id} not found for model id={model_id}.")

    # Validate that the workspace owns the provider, belongs to its owner, or was
    # explicitly granted access to an administrator-managed shared model.
    if tenant_id != provider_obj.tenant_id:
        joined_tenants = TenantService.list_accessible_by_user_id(tenant_id)
        joined_tenant_ids = [t["tenant_id"] for t in joined_tenants]
        if provider_obj.tenant_id not in joined_tenant_ids and not SharedModelService.can_use(tenant_id, model_id):
            raise LookupError(f"Tenant {tenant_id} has no access to provider owned by tenant {provider_obj.tenant_id}.")

    ok, instance_obj = TenantModelInstanceService.get_by_id(model_obj.instance_id)
    if not ok:
        raise LookupError(f"Instance id={model_obj.instance_id} not found for model id={model_id}.")

    api_key, is_tool, api_key_payload = _decode_api_key_config(instance_obj.api_key)
    extra_fields = json.loads(instance_obj.extra) if instance_obj.extra else {}
    model_extra = json.loads(model_obj.extra) if model_obj.extra else {}

    model_config = {
        "llm_factory": provider_obj.provider_name,
        "api_key": api_key,
        "llm_name": model_obj.model_name,
        "api_base": extra_fields.get("base_url", ""),
        "model_type": model_type_val,
        "is_tools": model_extra.get("is_tools", is_tool),
        "max_tokens": model_extra.get("max_tokens") or 8192,
    }
    if provider_obj.provider_name.lower() == "somark":
        model_config["extra"] = model_extra

    if api_key_payload is not None:
        model_config["api_key_payload"] = api_key_payload

    return model_config


def resolve_model_id(tenant_id: str, model_type: str | enum.Enum, model_name: str) -> str | None:
    """Given a tenant_id, model_type and model_name (e.g. 'model@instance@provider'),
    look up the corresponding tenant_model.id. Returns None if not found."""
    pure_model_name, instance_name, provider_name = split_model_name(model_name)
    model_type_val = model_type if isinstance(model_type, str) else model_type.value

    # Builtin TEI embedding — no tenant_model row exists
    compose_profiles = os.getenv("COMPOSE_PROFILES", "")
    is_tei_builtin_embedding = (
        model_type_val == LLMType.EMBEDDING.value and "tei-" in compose_profiles and pure_model_name == os.getenv("TEI_MODEL", "") and (provider_name == "Builtin" or not provider_name)
    )
    if is_tei_builtin_embedding:
        return None

    if not provider_name:
        raise LookupError(f"Provider name is required to resolve model id for {model_name}.")

    provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)
    if not provider_obj:
        shared_model = _resolve_shared_model_by_name(tenant_id, model_name, model_type_val)
        if shared_model:
            return shared_model.id
        raise LookupError(f"Provider {provider_name} not found for model {model_name}.")

    instance_obj = _resolve_instance_for_model(provider_obj, instance_name, model_name)
    model_obj = TenantModelService.get_by_provider_id_and_instance_id_and_model_type_and_model_name(provider_obj.id, instance_obj.id, model_type_val, pure_model_name)
    if not model_obj:
        raise LookupError(f"Model {model_name} not found for type {model_type_val}.")
    return model_obj.id


# Mapping from model-name field → (LLMType, tenant_model id field)
_MODEL_NAME_TO_ID_FIELD_MAP: dict[str, tuple[str, str]] = {
    "llm_id": (LLMType.CHAT, "tenant_llm_id"),
    "embd_id": (LLMType.EMBEDDING, "tenant_embd_id"),
    "rerank_id": (LLMType.RERANK, "tenant_rerank_id"),
    "asr_id": (LLMType.ASR, "tenant_asr_id"),
    "img2txt_id": (LLMType.VISION, "tenant_img2txt_id"),
    "tts_id": (LLMType.TTS, "tenant_tts_id"),
}


def ensure_tenant_model_ids_for_params(tenant_id: str, params: dict) -> dict:
    """For each model-name field present in *params*, resolve the corresponding
    tenant_model id if the id field is not already present.

    Modifies *params* in-place (adds ``tenant_*_id`` keys) and returns it.
    Silently skips resolution when the model is not found in tenant_model
    (e.g. builtin TEI embedding).

    Typical usage at API entry points:

        req = await get_request_json()
        ensure_tenant_model_ids_for_params(current_user.id, req)
        # req now has tenant_llm_id / tenant_embd_id etc. filled in
    """
    for name_field, (model_type, id_field) in _MODEL_NAME_TO_ID_FIELD_MAP.items():
        if name_field in params and id_field not in params:
            try:
                params[id_field] = resolve_model_id(tenant_id, model_type, params[name_field])
            except LookupError:
                logger.debug("Could not resolve %s → %s for tenant %s, skipping", name_field, id_field, tenant_id)
    return params


def validate_tenant_model_ids_for_params(tenant_id: str, params: dict) -> dict:
    """Reject model references that the target workspace cannot use."""
    for name_field, (model_type, id_field) in _MODEL_NAME_TO_ID_FIELD_MAP.items():
        model_id = params.get(id_field)
        if model_id:
            get_model_config_by_id(tenant_id, model_type, model_id)
        elif params.get(name_field):
            resolve_model_config(tenant_id, model_type, params[name_field])
    return params


def get_api_key(tenant_id: str, model_name: str):
    _, instance_name, provider_name = split_model_name(model_name)

    if not provider_name:
        raise LookupError("Provider name is required.")
    provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)
    if not provider_obj:
        shared_model = _resolve_shared_model_by_name(tenant_id, model_name)
        if not shared_model:
            raise LookupError(f"Provider {provider_name} not found.")
        ok, instance_obj = TenantModelInstanceService.get_by_id(shared_model.instance_id)
        if not ok:
            raise LookupError(f"Instance for shared model {model_name} not found.")
        return instance_obj.api_key
    instance_obj = _resolve_instance_for_model(provider_obj, instance_name, model_name)
    return instance_obj.api_key


def get_model_type_by_id(model_id: str):
    exist, model_obj = TenantModelService.get_by_id(model_id)
    if not exist:
        raise LookupError(f"TenantModel id={model_id} not found.")
    return get_model_type_human(model_obj.model_type)


def get_composite_model_name_by_id(model_id: str) -> str:
    """Convert a TenantModel id to ``model@instance@provider``."""
    exist, model_obj = TenantModelService.get_by_id(model_id)
    if not exist:
        raise LookupError(f"TenantModel id={model_id} not found.")
    ok, instance_obj = TenantModelInstanceService.get_by_id(model_obj.instance_id)
    if not ok:
        raise LookupError(f"Instance id={model_obj.instance_id} not found for model id={model_id}.")
    ok, provider_obj = TenantModelProviderService.get_by_id(model_obj.provider_id)
    if not ok:
        raise LookupError(f"Provider id={model_obj.provider_id} not found for model id={model_id}.")
    return f"{model_obj.model_name}@{instance_obj.instance_name}@{provider_obj.provider_name}"


def get_composite_model_name_by_ids(model_ids: list[str]) -> dict[str, str]:
    """Resolve many TenantModel ids, skipping incomplete rows."""
    if not model_ids:
        return {}
    models = list(TenantModelService.get_by_ids(model_ids))
    instances = list(TenantModelInstanceService.get_by_ids(list({model.instance_id for model in models}))) if models else []
    providers = list(TenantModelProviderService.get_by_ids(list({model.provider_id for model in models}))) if models else []
    instance_map = {instance.id: instance for instance in instances}
    provider_map = {provider.id: provider for provider in providers}
    result = {}
    for model in models:
        instance = instance_map.get(model.instance_id)
        provider = provider_map.get(model.provider_id)
        if instance and provider:
            result[model.id] = f"{model.model_name}@{instance.instance_name}@{provider.provider_name}"
    return result


def resolve_model_type(tenant_id: str, model_ref: str):
    try:
        return get_model_type_by_id(model_ref)
    except LookupError:
        return get_model_type_by_name(tenant_id, model_ref)


def get_model_type_by_name(tenant_id: str, model_name: str):
    pure_model_name, instance_name, provider_name = split_model_name(model_name)
    provider_obj = TenantModelProviderService.get_by_tenant_id_and_provider_name(tenant_id, provider_name)
    if not provider_obj:
        shared_model = _resolve_shared_model_by_name(tenant_id, model_name)
        if shared_model:
            return get_model_type_human(shared_model.model_type)
        raise LookupError(f"Provider {provider_name} not found for model {model_name}.")
    instance_obj = TenantModelInstanceService.get_by_provider_id_and_instance_name(provider_obj.id, instance_name)
    if not instance_obj:
        raise LookupError(f"Instance {instance_name} not found for model {model_name}.")
    model_obj = TenantModelService.get_by_provider_id_and_instance_id_and_model_name(provider_obj.id, instance_obj.id, pure_model_name)
    if not model_obj:
        raise LookupError(f"Model {model_name} not found.")
    return get_model_type_human(model_obj.model_type)


def delete_models_by_instance_ids(instance_ids: list[str]):
    return TenantModelService.delete_by_instance_ids(instance_ids)


def delete_instances_by_provider_ids(provider_ids: list[str]):
    return TenantModelInstanceService.delete_by_provider_ids(provider_ids)


def ensure_opendataloader_from_env(tenant_id: str) -> str | None:
    return _ensure_ocr_provider_from_env(
        tenant_id,
        "OpenDataLoader",
        "opendataloader-from-env",
        _collect_env_config(OPENDATALOADER_ENV_KEYS, OPENDATALOADER_DEFAULT_CONFIG),
    )


def ensure_somark_from_env(tenant_id: str) -> str | None:
    return _ensure_ocr_provider_from_env(
        tenant_id,
        "SoMark",
        "somark-from-env",
        _collect_env_config(SOMARK_ENV_KEYS, SOMARK_DEFAULT_CONFIG),
    )
