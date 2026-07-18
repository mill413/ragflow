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

from collections.abc import Mapping
from typing import Any

from api.db import CanvasCategory
from api.db.db_models import (
    API4Conversation,
    Connector,
    Connector2Kb,
    Dialog,
    Document,
    Knowledgebase,
    Search,
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
    }

    @staticmethod
    def _value(record: Mapping[str, Any] | Any, field: str, default=None):
        if isinstance(record, Mapping):
            return record.get(field, default)
        return getattr(record, field, default)

    @classmethod
    def _target(cls, resource_type: str, resource: Mapping[str, Any] | Any) -> dict:
        id_field, name_field, workspace_field = cls.RESOURCE_TYPE_FIELDS[resource_type]
        return {
            "resource_type": resource_type,
            "resource_id": str(cls._value(resource, id_field, "")),
            "resource_name": str(cls._value(resource, name_field, "") or ""),
            "workspace_id": str(cls._value(resource, workspace_field, "")),
        }

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
    def _canvas_references(cls, workspace_id: str, target_id: str, keys: set[str]) -> list[dict]:
        references: list[dict] = []
        canvases = list(UserCanvas.select(UserCanvas.id, UserCanvas.title, UserCanvas.canvas_category, UserCanvas.dsl).where(UserCanvas.user_id == workspace_id))
        canvas_by_id = {canvas.id: canvas for canvas in canvases}

        for canvas in canvases:
            if target_id in cls._extract_ids(canvas.dsl, keys):
                resource_type = "agent" if canvas.canvas_category == CanvasCategory.Agent else "dataflow"
                references.append(cls._reference(resource_type, canvas.id, canvas.title))

        if not canvas_by_id:
            return references

        canvas_ids = list(canvas_by_id)

        released_versions = UserCanvasVersion.select(
            UserCanvasVersion.id,
            UserCanvasVersion.user_canvas_id,
            UserCanvasVersion.title,
            UserCanvasVersion.dsl,
        ).where(
            UserCanvasVersion.user_canvas_id.in_(canvas_ids),
            UserCanvasVersion.release == True,  # noqa: E712
        )
        for version in released_versions:
            if target_id in cls._extract_ids(version.dsl, keys):
                canvas = canvas_by_id.get(version.user_canvas_id)
                name = version.title or (canvas.title if canvas else "")
                references.append(cls._reference("agent_version", version.id, name))

        sessions = API4Conversation.select(
            API4Conversation.id,
            API4Conversation.dialog_id,
            API4Conversation.name,
            API4Conversation.dsl,
        ).where(API4Conversation.dialog_id.in_(canvas_ids))
        for session in sessions:
            if target_id in cls._extract_ids(session.dsl, keys):
                canvas = canvas_by_id.get(session.dialog_id)
                name = session.name or (canvas.title if canvas else "")
                references.append(cls._reference("agent_session", session.id, name))

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
    def find_references(cls, resource_type: str, resource: Mapping[str, Any] | Any) -> tuple[dict, list[dict]]:
        target = cls._target(resource_type, resource)
        finders = {
            "dataset": cls._dataset_references,
            "memory": cls._memory_references,
            "mcp": cls._mcp_references,
            "compilation_template": cls._compilation_template_references,
            "data_source": cls._data_source_references,
        }
        references = finders[resource_type](target)
        unique_references = {(reference["resource_type"], reference["resource_id"]): reference for reference in references}
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
