#
#  Copyright 2024 The InfiniFlow Authors. All Rights Reserved.
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
import logging
import json
from datetime import datetime

from api.apps import current_user, login_required
from api.db.services.canvas_service import UserCanvasService
from api.db.services.document_service import DocumentService
from api.db.services.knowledgebase_service import KnowledgebaseService
from api.db.services.task_service import TaskService, CANVAS_DEBUG_DOC_ID, GRAPH_RAPTOR_FAKE_DOC_ID, task_authorization_key
from api.db.services.workspace_service import WorkspaceAccessService
from api.utils.api_utils import (
    get_json_result,
    get_request_json,
    validate_request,
)
from common.constants import RetCode, TaskStatus
from rag.utils.redis_conn import REDIS_CONN


@manager.route("/tasks/<task_id>/cancel", methods=["POST"])  # noqa: F821
@login_required
async def cancel_task(task_id):
    """Cancel a running task."""
    return await _cancel_task(task_id)


@manager.route("/tasks/<task_id>", methods=["PATCH"])  # noqa: F821
@login_required
@validate_request("action")
async def patch_task(task_id):
    req = await get_request_json()
    action = req.get("action")

    if action != "stop":
        return get_json_result(
            code=RetCode.ARGUMENT_ERROR,
            message=f"Invalid action '{action}'. Only 'stop' is supported.",
        )

    return await _cancel_task(task_id)


async def _cancel_task(task_id):
    """
    Sets a Redis cancel flag, updates the task progress to -1 (cancelled),
        and marks the associated document's run status as CANCEL if applicable.
    """
    exists, task = TaskService.get_by_id(task_id)
    if not _can_cancel_task(task_id, task if exists else None, current_user.id):
        return get_json_result(code=RetCode.FORBIDDEN, message="No authorization.", data=False)

    try:
        REDIS_CONN.set(f"{task_id}-cancel", "x")
    except Exception as e:
        logging.exception("Failed to set cancel flag for task %s: %s", task_id, str(e))
        return get_json_result(
            code=RetCode.CONNECTION_ERROR,
            message="Failed to stop task",
        )

    if not exists:
        return get_json_result(data=True)

    # Append a cancellation message so the user can see it in progress_msg.
    try:
        cancel_msg = f"\n{datetime.now().strftime('%H:%M:%S')} Task stopped by user."
        # Only transition to -1 if the task is still in a non-terminal state,
        # mirroring TaskService.update_progress semantics.
        TaskService.model.update(
            progress_msg=TaskService.model.progress_msg + cancel_msg,
            progress=-1,
        ).where((TaskService.model.id == task_id) & (TaskService.model.progress >= 0) & (TaskService.model.progress < 1)).execute()
    except Exception as e:
        logging.warning("Failed to update task %s progress after cancellation: %s", task_id, str(e))

    # If the task belongs to a document, also mark the document's run status as
    # cancelled so that the UI reflects the state correctly.
    try:
        from api.db.services.document_service import DocumentService

        doc_id = task.doc_id
        if doc_id and doc_id not in (CANVAS_DEBUG_DOC_ID, GRAPH_RAPTOR_FAKE_DOC_ID):
            _, doc = DocumentService.get_by_id(doc_id)
            if doc and str(doc.run) in (TaskStatus.RUNNING.value, TaskStatus.SCHEDULE.value):
                cancel_doc_msg = f"\n{datetime.now().strftime('%H:%M:%S')} Task stopped by user."
                DocumentService.update_by_id(
                    doc_id,
                    {"run": TaskStatus.CANCEL.value, "progress": 0, "progress_msg": (doc.progress_msg or "") + cancel_doc_msg},
                )
                logging.debug("Appended cancellation marker to progress_msg on task cancel: task_id=%s doc_id=%s", task_id, doc_id)
    except Exception as e:
        logging.warning("Failed to update document run status for task %s: %s", task_id, str(e))

    logging.info(f"Cancel task succeeded: task_id={task_id} doc_id={task.doc_id}")
    return get_json_result(data=True)


def _can_cancel_task(task_id: str, task, user_id: str) -> bool:
    if task and task.doc_id not in (CANVAS_DEBUG_DOC_ID, GRAPH_RAPTOR_FAKE_DOC_ID):
        kb_id = DocumentService.get_knowledgebase_id(task.doc_id)
        return bool(kb_id and KnowledgebaseService.modifiable(kb_id, user_id))

    if task and task.doc_id == GRAPH_RAPTOR_FAKE_DOC_ID:
        task_fields = (
            KnowledgebaseService.model.graphrag_task_id,
            KnowledgebaseService.model.raptor_task_id,
            KnowledgebaseService.model.mindmap_task_id,
            KnowledgebaseService.model.artifact_task_id,
            KnowledgebaseService.model.skill_task_id,
        )
        condition = task_fields[0] == task_id
        for field in task_fields[1:]:
            condition |= field == task_id
        knowledgebase = KnowledgebaseService.model.get_or_none(condition)
        return bool(knowledgebase and WorkspaceAccessService.can_update_knowledgebase(user_id, knowledgebase))

    try:
        raw_metadata = REDIS_CONN.get(task_authorization_key(task_id))
        metadata = json.loads(raw_metadata) if raw_metadata else None
    except Exception:
        logging.warning("Failed to load task authorization metadata for task %s", task_id, exc_info=True)
        return False
    if not isinstance(metadata, dict):
        return False

    resource_id = metadata.get("resource_id")
    workspace_id = metadata.get("workspace_id")
    exists, agent = UserCanvasService.get_by_id(resource_id)
    if not exists or not agent or str(agent.user_id) != str(workspace_id):
        return False
    if WorkspaceAccessService.can_manage_shared_resource(
        user_id,
        agent,
        workspace_field="user_id",
        permission_field="permission",
    ):
        return True
    return str(metadata.get("actor_id")) == str(user_id) and WorkspaceAccessService.can_read_shared_resource(
        user_id,
        agent,
        workspace_field="user_id",
        permission_field="permission",
    )
