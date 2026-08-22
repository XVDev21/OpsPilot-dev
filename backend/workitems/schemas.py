from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from ninja import ModelSchema, Schema
from pydantic import StringConstraints

from workitems.models import WorkItem


class WorkflowHandoffSchema(Schema):
    id: UUID
    sourceRunId: UUID
    target: Literal["work-item", "meeting-actions", "status-update"]
    status: Literal["draft", "converted"]
    draftInput: dict
    targetRunId: UUID | None
    createdAt: datetime
    convertedAt: datetime | None


class CreateHandoffInput(Schema):
    target: Literal["work-item", "meeting-actions", "status-update"]


class WorkItemSchema(ModelSchema):
    id: UUID
    source_run_id: UUID | None
    source_handoff_id: UUID | None
    created_at: datetime
    updated_at: datetime

    class Meta:
        model = WorkItem
        fields = [
            "id",
            "title",
            "description",
            "kind",
            "status",
            "assignee_id",
            "due_date",
            "created_at",
            "updated_at",
        ]


class CreateWorkItemInput(Schema):
    handoffId: UUID | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=12, max_length=6000)
    ]
    kind: Literal["engineering", "verification", "investigation", "follow-up"]
    assigneeId: Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)] = ""
    dueDate: date | None = None


class UpdateWorkItemInput(Schema):
    status: Literal["todo", "in-progress", "blocked", "done"]


class WorkItemList(Schema):
    items: list[WorkItemSchema]
