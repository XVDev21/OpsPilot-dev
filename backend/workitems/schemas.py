from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from ninja import Schema
from pydantic import StringConstraints, model_validator


class WorkflowHandoffSchema(Schema):
    id: UUID
    caseId: UUID | None
    sourceRunId: UUID
    target: Literal["work-item", "meeting-actions", "status-update"]
    status: Literal["draft", "converted"]
    draftInput: dict
    targetRunId: UUID | None
    createdAt: datetime
    convertedAt: datetime | None


class CreateHandoffInput(Schema):
    target: Literal["work-item", "meeting-actions", "status-update"]


class WorkItemSchema(Schema):
    id: UUID
    caseId: UUID | None
    title: str
    description: str
    kind: Literal["engineering", "verification", "investigation", "follow-up"]
    status: Literal["todo", "in-progress", "blocked", "done"]
    assigneeId: UUID | None
    assigneeKey: str | None
    assigneeName: str | None
    dueDate: date | None
    blockerReason: str
    completedAt: datetime | None
    sourceRunId: UUID | None
    sourceHandoffId: UUID | None
    createdAt: datetime
    updatedAt: datetime


class CreateWorkItemInput(Schema):
    handoffId: UUID | None = None
    caseId: UUID | None = None
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    description: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=12, max_length=6000)
    ]
    kind: Literal["engineering", "verification", "investigation", "follow-up"]
    assigneeId: UUID | None = None
    dueDate: date | None = None


class UpdateWorkItemInput(Schema):
    status: Literal["todo", "in-progress", "blocked", "done"] | None = None
    assigneeId: UUID | None = None
    dueDate: date | None = None
    blockerReason: Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, max_length=2000),
    ] = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one work-item change.")
        return self


class WorkItemListQuery(Schema):
    status: Literal["todo", "in-progress", "blocked", "done"] | None = None
    assigneeId: UUID | None = None
    caseId: UUID | None = None


class WorkItemList(Schema):
    items: list[WorkItemSchema]
