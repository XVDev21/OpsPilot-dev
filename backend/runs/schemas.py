from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from ninja import ModelSchema, Schema

from runs.models import WorkflowRun


class WorkflowRunSchema(ModelSchema):
    id: UUID
    workflow_id: Literal["bug-triage", "meeting-actions", "status-update"]
    input_json: dict[str, Any]
    result_json: dict[str, Any] | None
    created_at: datetime
    completed_at: datetime | None
    expires_at: datetime | None

    class Meta:
        model = WorkflowRun
        fields = [
            "id",
            "workflow_id",
            "status",
            "input_json",
            "result_json",
            "error_code",
            "provider",
            "model",
            "intelligence",
            "prompt_version",
            "input_tokens",
            "output_tokens",
            "duration_ms",
            "created_at",
            "completed_at",
            "expires_at",
        ]


class RunListResponse(Schema):
    items: list[WorkflowRunSchema]
    next_cursor: str | None = None


class RunOptions(Schema):
    provider: Literal["gemini", "openai"] | None = None
    intelligence: Literal["fast", "balanced", "high"] | None = None


class CreateWorkflowRunRequest(Schema):
    input: dict[str, Any]
    options: RunOptions | None = None
