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

from collections.abc import Callable, Mapping
from typing import Any

from api.db import CanvasCategory
from api.db.db_models import (
    API4Conversation,
    CompilationTemplate,
    Connector,
    Connector2Kb,
    Dialog,
    Document,
    Knowledgebase,
    Memory,
    Search,
    Tenant,
    TenantModel,
    TenantModelGroup,
    TenantModelGroupMapping,
    TenantModelInstance,
    TenantModelProvider,
    UserCanvas,
    UserCanvasVersion,
)
from common.constants import StatusEnum
from common.exceptions import ResourceInUseException


class ResourceReferenceService:
    RESOURCE_TYPE_FIELDS = {
        "dataset": ("id", "name", "tenant_id"),
        "memory": ("id", "name", "tenant_id"),
        "mcp": ("id", "name", "tenant_id"),
        "compilation_template": ("id", "name", "tenant_id"),
        "data_source": ("id", "name", "tenant_id"),
        "model": ("id", "name", "tenant_id"),
        "file": ("id", "name", "tenant_id"),
        "dataflow": ("id", "title", "user_id"),
    }

    @staticmethod
    def _value(record: Mapping[str, Any] | Any, field: str, default=None):
        if isinstance(record, Mapping):
            return record.get(field, default)
        return getattr(record, field, default)

    @classmethod
    def _target(cls, resource_type: str, resource: Mapping[str, Any] | Any) -> dict:
        id_field, name_field, workspace_field = cls.RESOURCE_TYPE_FIELDS[resource_type]
        target = {
            "resource_type": resource_type,
            "resource_id": str(cls._value(resource, id_field, "")),
            "resource_name": str(cls._value(resource, name_field, "") or ""),
            "workspace_id": str(cls._value(resource, workspace_field, "")),
        }
        identifiers = cls._value(resource, "identifiers")
        if identifiers:
            target["identifiers"] = [str(identifier) for identifier in identifiers if identifier]
        return target

    @staticmethod
    def _extract_ids(value: Any, keys: set[str]) -> set[str]:
        identifiers: set[str] = set()

        def visit(item: Any) -> None:
            if isinstance(item, Mapping):
                for key, nested in item.items():
                    if key in keys:
                        if isinstance(nested, str) and nested and "@" not in nested:
                            identifiers.add(nested)
                        elif isinstance(nested, (list, tuple, set)):
                            identifiers.update(identifier for identifier in nested if isinstance(identifier, str) and identifier and "@" not in identifier)
                    else:
                        visit(nested)
            elif isinstance(item, (list, tuple, set)):
                for nested in item:
                    visit(nested)

        visit(value)
        return identifiers

    @staticmethod
    def _reference(resource_type: str, resource_id: str, resource_name: str) -> dict:
        return {
            "resource_type": resource_type,
            "resource_id": str(resource_id),
            "resource_name": str(resource_name or ""),
        }

    @classmethod
    def _contains_model_reference(cls, value: Any, identifiers: set[str]) -> bool:
        if isinstance(value, str):
            return value in identifiers
        if isinstance(value, Mapping):
            return any(cls._contains_model_reference(nested, identifiers) for nested in value.values())
        if isinstance(value, (list, tuple, set)):
            return any(cls._contains_model_reference(nested, identifiers) for nested in value)
        return False

    @classmethod
    def _canvas_references(
        cls,
        workspace_id: str,
        target_id: str,
        keys: set[str] | None = None,
        extractor: Callable[[Any], set[str]] | None = None,
    ) -> list[dict]:
        references: list[dict] = []
        canvases = list(UserCanvas.select(UserCanvas.id, UserCanvas.title, UserCanvas.canvas_category, UserCanvas.dsl).where(UserCanvas.user_id == workspace_id))
        canvas_by_id = {canvas.id: canvas for canvas in canvases}

        def contains_reference(value: Any) -> bool:
            identifiers = extractor(value) if extractor else cls._extract_ids(value, keys or set())
            return target_id in identifiers

        for canvas in canvases:
            if contains_reference(canvas.dsl):
                resource_type = "agent" if canvas.canvas_category == CanvasCategory.Agent else "dataflow"
                references.append(cls._reference(resource_type, canvas.id, canvas.title))

        if not canvas_by_id:
            return references

        canvas_ids = list(canvas_by_id)

        versions = UserCanvasVersion.select(
            UserCanvasVersion.id,
            UserCanvasVersion.user_canvas_id,
            UserCanvasVersion.title,
            UserCanvasVersion.dsl,
        ).where(UserCanvasVersion.user_canvas_id.in_(canvas_ids))
        for version in versions:
            if contains_reference(version.dsl):
                canvas = canvas_by_id.get(version.user_canvas_id)
                name = version.title or (canvas.title if canvas else "")
                resource_type = "agent_version" if canvas and canvas.canvas_category == CanvasCategory.Agent else "dataflow_version"
                references.append(cls._reference(resource_type, version.id, name))

        sessions = API4Conversation.select(
            API4Conversation.id,
            API4Conversation.dialog_id,
            API4Conversation.name,
            API4Conversation.dsl,
        ).where(API4Conversation.dialog_id.in_(canvas_ids))
        for session in sessions:
            if contains_reference(session.dsl):
                canvas = canvas_by_id.get(session.dialog_id)
                name = session.name or (canvas.title if canvas else "")
                resource_type = "agent_session" if canvas and canvas.canvas_category == CanvasCategory.Agent else "dataflow_session"
                references.append(cls._reference(resource_type, session.id, name))

        return references

    @classmethod
    def _dataset_references(cls, target: dict) -> list[dict]:
        target_id = target["resource_id"]
        workspace_id = target["workspace_id"]
        references: list[dict] = []

        dialogs = Dialog.select(Dialog.id, Dialog.name, Dialog.kb_ids).where(
            Dialog.tenant_id == workspace_id,
            Dialog.status == StatusEnum.VALID.value,
        )
        references.extend(cls._reference("chat", dialog.id, dialog.name) for dialog in dialogs if target_id in set(dialog.kb_ids or []))

        searches = Search.select(Search.id, Search.name, Search.search_config).where(
            Search.tenant_id == workspace_id,
            Search.status == StatusEnum.VALID.value,
        )
        references.extend(cls._reference("search", search.id, search.name) for search in searches if target_id in cls._extract_ids(search.search_config, {"kb_ids", "dataset_ids"}))
        references.extend(cls._canvas_references(workspace_id, target_id, {"kb_ids", "dataset_ids"}))

        links = Connector2Kb.select(Connector2Kb.connector_id).where(Connector2Kb.kb_id == target_id)
        connector_ids = {link.connector_id for link in links}
        if connector_ids:
            connectors = Connector.select(Connector.id, Connector.name).where(
                Connector.id.in_(connector_ids),
                Connector.tenant_id == workspace_id,
            )
            references.extend(cls._reference("data_source", connector.id, connector.name) for connector in connectors)
        return references

    @classmethod
    def _memory_references(cls, target: dict) -> list[dict]:
        return cls._canvas_references(target["workspace_id"], target["resource_id"], {"memory_id", "memory_ids"})

    @classmethod
    def _mcp_references(cls, target: dict) -> list[dict]:
        return cls._canvas_references(target["workspace_id"], target["resource_id"], {"mcp_id", "mcp_ids"})

    @classmethod
    def _compilation_template_references(cls, target: dict) -> list[dict]:
        target_id = target["resource_id"]
        workspace_id = target["workspace_id"]
        keys = {"compilation_template_group_id", "compilation_template_group_ids"}
        references: list[dict] = []

        datasets = list(
            Knowledgebase.select(Knowledgebase.id, Knowledgebase.name, Knowledgebase.parser_config).where(
                Knowledgebase.tenant_id == workspace_id,
                Knowledgebase.status == StatusEnum.VALID.value,
            )
        )
        references.extend(cls._reference("dataset", dataset.id, dataset.name) for dataset in datasets if target_id in cls._extract_ids(dataset.parser_config, keys))

        dataset_by_id = {dataset.id: dataset for dataset in datasets}
        if dataset_by_id:
            dataset_ids = list(dataset_by_id)
            documents = Document.select(Document.id, Document.name, Document.kb_id, Document.parser_config).where(
                Document.kb_id.in_(dataset_ids),
                Document.status == StatusEnum.VALID.value,
            )
            for document in documents:
                if target_id not in cls._extract_ids(document.parser_config, keys):
                    continue
                dataset = dataset_by_id.get(document.kb_id)
                name = f"{dataset.name} / {document.name}" if dataset else document.name
                references.append(cls._reference("document", document.id, name))

        references.extend(cls._canvas_references(workspace_id, target_id, keys))
        return references

    @classmethod
    def _data_source_references(cls, target: dict) -> list[dict]:
        links = Connector2Kb.select(Connector2Kb.kb_id).where(Connector2Kb.connector_id == target["resource_id"])
        dataset_ids = {link.kb_id for link in links}
        if not dataset_ids:
            return []
        datasets = Knowledgebase.select(Knowledgebase.id, Knowledgebase.name).where(
            Knowledgebase.id.in_(dataset_ids),
            Knowledgebase.tenant_id == target["workspace_id"],
            Knowledgebase.status == StatusEnum.VALID.value,
        )
        return [cls._reference("dataset", dataset.id, dataset.name) for dataset in datasets]

    @classmethod
    def _file_references(cls, target: dict) -> list[dict]:
        from api.db.services.workspace_service import WorkspaceAccessService

        return cls._canvas_references(
            target["workspace_id"],
            target["resource_id"],
            extractor=WorkspaceAccessService.extract_static_file_ids,
        )

    @classmethod
    def _dataflow_references(cls, target: dict) -> list[dict]:
        target_id = target["resource_id"]
        workspace_id = target["workspace_id"]
        references: list[dict] = []
        datasets = list(
            Knowledgebase.select(Knowledgebase.id, Knowledgebase.name, Knowledgebase.pipeline_id).where(
                Knowledgebase.tenant_id == workspace_id,
                Knowledgebase.status == StatusEnum.VALID.value,
            )
        )
        references.extend(
            cls._reference("dataset", dataset.id, dataset.name)
            for dataset in datasets
            if dataset.pipeline_id == target_id
        )

        dataset_by_id = {dataset.id: dataset for dataset in datasets}
        if dataset_by_id:
            documents = Document.select(Document.id, Document.name, Document.kb_id, Document.pipeline_id).where(
                Document.kb_id.in_(list(dataset_by_id)),
                Document.status == StatusEnum.VALID.value,
            )
            for document in documents:
                if document.pipeline_id != target_id:
                    continue
                dataset = dataset_by_id.get(document.kb_id)
                name = f"{dataset.name} / {document.name}" if dataset else document.name
                references.append(cls._reference("document", document.id, name))
        return references

    @classmethod
    def _model_references(cls, target: dict) -> list[dict]:
        workspace_id = target["workspace_id"]
        identifiers = set(target.get("identifiers") or [target["resource_id"]])
        references: list[dict] = []

        def add_if_referenced(resource_type: str, resource_id: str, resource_name: str, value: Any) -> None:
            if cls._contains_model_reference(value, identifiers):
                references.append(cls._reference(resource_type, resource_id, resource_name))

        tenant = Tenant.get_or_none(id=workspace_id, status=StatusEnum.VALID.value)
        if tenant:
            add_if_referenced(
                "workspace",
                tenant.id,
                tenant.name or tenant.id,
                {
                    "llm_id": tenant.llm_id,
                    "tenant_llm_id": tenant.tenant_llm_id,
                    "embd_id": tenant.embd_id,
                    "tenant_embd_id": tenant.tenant_embd_id,
                    "asr_id": tenant.asr_id,
                    "tenant_asr_id": tenant.tenant_asr_id,
                    "img2txt_id": tenant.img2txt_id,
                    "tenant_img2txt_id": tenant.tenant_img2txt_id,
                    "rerank_id": tenant.rerank_id,
                    "tenant_rerank_id": tenant.tenant_rerank_id,
                    "tts_id": tenant.tts_id,
                    "tenant_tts_id": tenant.tenant_tts_id,
                    "ocr_id": tenant.ocr_id,
                    "tenant_ocr_id": tenant.tenant_ocr_id,
                },
            )

        datasets = list(
            Knowledgebase.select(
                Knowledgebase.id,
                Knowledgebase.name,
                Knowledgebase.embd_id,
                Knowledgebase.tenant_embd_id,
                Knowledgebase.parser_config,
            ).where(
                Knowledgebase.tenant_id == workspace_id,
                Knowledgebase.status == StatusEnum.VALID.value,
            )
        )
        for dataset in datasets:
            add_if_referenced(
                "dataset",
                dataset.id,
                dataset.name,
                {
                    "embd_id": dataset.embd_id,
                    "tenant_embd_id": dataset.tenant_embd_id,
                    "parser_config": dataset.parser_config,
                },
            )

        dataset_by_id = {dataset.id: dataset for dataset in datasets}
        if dataset_by_id:
            documents = Document.select(Document.id, Document.name, Document.kb_id, Document.parser_config).where(
                Document.kb_id.in_(list(dataset_by_id)),
                Document.status == StatusEnum.VALID.value,
            )
            for document in documents:
                dataset = dataset_by_id.get(document.kb_id)
                name = f"{dataset.name} / {document.name}" if dataset else document.name
                add_if_referenced("document", document.id, name, document.parser_config)

        dialogs = Dialog.select(
            Dialog.id,
            Dialog.name,
            Dialog.llm_id,
            Dialog.tenant_llm_id,
            Dialog.rerank_id,
            Dialog.tenant_rerank_id,
            Dialog.llm_setting,
            Dialog.prompt_config,
        ).where(
            Dialog.tenant_id == workspace_id,
            Dialog.status == StatusEnum.VALID.value,
        )
        for dialog in dialogs:
            add_if_referenced(
                "chat",
                dialog.id,
                dialog.name,
                {
                    "llm_id": dialog.llm_id,
                    "tenant_llm_id": dialog.tenant_llm_id,
                    "rerank_id": dialog.rerank_id,
                    "tenant_rerank_id": dialog.tenant_rerank_id,
                    "llm_setting": dialog.llm_setting,
                    "prompt_config": dialog.prompt_config,
                },
            )

        searches = Search.select(Search.id, Search.name, Search.search_config).where(
            Search.tenant_id == workspace_id,
            Search.status == StatusEnum.VALID.value,
        )
        for search in searches:
            add_if_referenced("search", search.id, search.name, search.search_config)

        memories = Memory.select(
            Memory.id,
            Memory.name,
            Memory.llm_id,
            Memory.tenant_llm_id,
            Memory.embd_id,
            Memory.tenant_embd_id,
        ).where(Memory.tenant_id == workspace_id)
        for memory in memories:
            add_if_referenced(
                "memory",
                memory.id,
                memory.name,
                {
                    "llm_id": memory.llm_id,
                    "tenant_llm_id": memory.tenant_llm_id,
                    "embd_id": memory.embd_id,
                    "tenant_embd_id": memory.tenant_embd_id,
                },
            )

        templates = CompilationTemplate.select(
            CompilationTemplate.id,
            CompilationTemplate.name,
            CompilationTemplate.config,
        ).where(
            CompilationTemplate.tenant_id == workspace_id,
            CompilationTemplate.status == StatusEnum.VALID.value,
        )
        for template in templates:
            add_if_referenced("compilation_template", template.id, template.name, template.config)

        mappings = list(
            TenantModelGroupMapping.select(TenantModelGroupMapping.group_id).where(
                TenantModelGroupMapping.model_id == target["resource_id"]
            )
        )
        group_ids = {mapping.group_id for mapping in mappings}
        if group_ids:
            groups = TenantModelGroup.select(TenantModelGroup.id, TenantModelGroup.model_name).where(
                TenantModelGroup.id.in_(group_ids)
            )
            references.extend(
                cls._reference("model_group", group.id, group.model_name or group.id)
                for group in groups
            )

        canvases = list(
            UserCanvas.select(UserCanvas.id, UserCanvas.title, UserCanvas.canvas_category, UserCanvas.dsl).where(
                UserCanvas.user_id == workspace_id
            )
        )
        canvas_by_id = {canvas.id: canvas for canvas in canvases}
        for canvas in canvases:
            resource_type = "agent" if canvas.canvas_category == CanvasCategory.Agent else "dataflow"
            add_if_referenced(resource_type, canvas.id, canvas.title, canvas.dsl)

        if canvas_by_id:
            canvas_ids = list(canvas_by_id)
            versions = UserCanvasVersion.select(
                UserCanvasVersion.id,
                UserCanvasVersion.user_canvas_id,
                UserCanvasVersion.title,
                UserCanvasVersion.dsl,
            ).where(UserCanvasVersion.user_canvas_id.in_(canvas_ids))
            for version in versions:
                canvas = canvas_by_id.get(version.user_canvas_id)
                resource_type = "agent_version" if canvas and canvas.canvas_category == CanvasCategory.Agent else "dataflow_version"
                add_if_referenced(
                    resource_type,
                    version.id,
                    version.title or (canvas.title if canvas else ""),
                    version.dsl,
                )

            sessions = API4Conversation.select(
                API4Conversation.id,
                API4Conversation.dialog_id,
                API4Conversation.name,
                API4Conversation.dsl,
            ).where(API4Conversation.dialog_id.in_(canvas_ids))
            for session in sessions:
                canvas = canvas_by_id.get(session.dialog_id)
                resource_type = "agent_session" if canvas and canvas.canvas_category == CanvasCategory.Agent else "dataflow_session"
                add_if_referenced(
                    resource_type,
                    session.id,
                    session.name or (canvas.title if canvas else ""),
                    session.dsl,
                )

        return references

    @classmethod
    def build_model_targets(cls, workspace_id: str, models: list[TenantModel]) -> list[dict]:
        if not models:
            return []
        provider_ids = {model.provider_id for model in models}
        instance_ids = {model.instance_id for model in models}
        providers = {
            provider.id: provider
            for provider in TenantModelProvider.select().where(
                TenantModelProvider.id.in_(provider_ids),
                TenantModelProvider.tenant_id == workspace_id,
            )
        }
        instances = {
            instance.id: instance
            for instance in TenantModelInstance.select().where(TenantModelInstance.id.in_(instance_ids))
        }
        targets = []
        for model in models:
            provider = providers.get(model.provider_id)
            instance = instances.get(model.instance_id)
            identifiers = [model.id]
            display_name = model.model_name or model.id
            if provider and instance and instance.provider_id == provider.id:
                display_name = f"{model.model_name}@{instance.instance_name}@{provider.provider_name}"
                identifiers.append(display_name)
                if instance.instance_name == "default":
                    identifiers.append(f"{model.model_name}@{provider.provider_name}")
            targets.append(
                {
                    "id": model.id,
                    "name": display_name,
                    "tenant_id": workspace_id,
                    "identifiers": identifiers,
                }
            )
        return targets

    @classmethod
    def ensure_models_not_referenced(cls, workspace_id: str, models: list[TenantModel]) -> None:
        cls.ensure_not_referenced("model", cls.build_model_targets(workspace_id, models))

    @classmethod
    def find_references(cls, resource_type: str, resource: Mapping[str, Any] | Any) -> tuple[dict, list[dict]]:
        target = cls._target(resource_type, resource)
        finders = {
            "dataset": cls._dataset_references,
            "memory": cls._memory_references,
            "mcp": cls._mcp_references,
            "compilation_template": cls._compilation_template_references,
            "data_source": cls._data_source_references,
            "model": cls._model_references,
            "file": cls._file_references,
            "dataflow": cls._dataflow_references,
        }
        references = finders[resource_type](target)
        unique_references = {(reference["resource_type"], reference["resource_id"]): reference for reference in references}
        target.pop("identifiers", None)
        return target, sorted(
            unique_references.values(),
            key=lambda reference: (reference["resource_type"], reference["resource_name"].casefold(), reference["resource_id"]),
        )

    @classmethod
    def ensure_not_referenced(cls, resource_type: str, resources: list[Mapping[str, Any] | Any]) -> None:
        targets: list[dict] = []
        references: list[dict] = []
        for resource in resources:
            target, target_references = cls.find_references(resource_type, resource)
            if not target_references:
                continue
            targets.append(target)
            references.extend({**reference, "target_resource_id": target["resource_id"]} for reference in target_references)
        if references:
            raise ResourceInUseException(targets, references)
