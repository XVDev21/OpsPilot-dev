from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from ninja import ModelSchema, Schema

from runs.models import WorkflowRun


class WorkflowRunSchema(ModelSchema):
    id: UUID
    case_id: UUID | None
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
            "execution_phase",
            "input_json",
            "result_json",
            "error_code",
            "provider",
            "credential_source",
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
    provider: Literal["gemini", "openai", "qwen", "bedrock", "custom", "local"] | None = None
    intelligence: Literal["fast", "balanced", "high"] | None = None


class CreateWorkflowRunRequest(Schema):
    input: dict[str, Any]
    options: RunOptions | None = None
    handoffId: UUID | None = None
    caseId: UUID | None = None
