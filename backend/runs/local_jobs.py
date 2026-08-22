from datetime import timedelta
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from pydantic import ValidationError

from ai.prompts import compile_prompt
from common.errors import OpsPilotError
from integrations.models import LocalConnector
from runs.models import LocalConnectorJob, WorkflowRun
from workflows.registry import get_workflow

LEASE_DURATION = timedelta(minutes=2)
MAX_ATTEMPTS = 3


@transaction.atomic
def claim_next_job(*, connector: LocalConnector) -> dict | None:
    now = timezone.now()
    exhausted = (
        LocalConnectorJob.objects.select_for_update()
        .select_related("run")
        .filter(
            connector=connector,
            status=LocalConnectorJob.Status.LEASED,
            lease_expires_at__lt=now,
            attempts__gte=MAX_ATTEMPTS,
        )
    )
    for exhausted_job in exhausted:
        _fail_job(exhausted_job, "LOCAL_CONNECTOR_UNAVAILABLE")
    expired = LocalConnectorJob.objects.filter(
        connector=connector,
        status=LocalConnectorJob.Status.LEASED,
        lease_expires_at__lt=now,
        attempts__lt=MAX_ATTEMPTS,
    )
    expired.update(status=LocalConnectorJob.Status.QUEUED, lease_expires_at=None)
    job = (
        LocalConnectorJob.objects.select_for_update(skip_locked=True)
        .select_related("run")
        .filter(connector=connector, status=LocalConnectorJob.Status.QUEUED)
        .order_by("created_at")
        .first()
    )
    if job is None:
        return None
    workflow = get_workflow(job.run.workflow_id)
    if workflow is None:
        _fail_job(job, "UNKNOWN_WORKFLOW")
        return None
    try:
        validated_input = workflow.input_schema.model_validate(job.run.input_json)
    except ValidationError:
        _fail_job(job, "INVALID_STORED_INPUT")
        return None
    system_instruction, user_content = compile_prompt(
        workflow=workflow,
        validated_input=validated_input,
    )
    job.status = LocalConnectorJob.Status.LEASED
    job.lease_expires_at = now + LEASE_DURATION
    job.attempts += 1
    job.save(update_fields=["status", "lease_expires_at", "attempts", "updated_at"])
    job.run.execution_phase = WorkflowRun.ExecutionPhase.GENERATING
    job.run.save(update_fields=["execution_phase"])
    return {
        "runId": job.run.id,
        "workflowId": job.run.workflow_id,
        "model": job.run.model,
        "systemInstruction": system_instruction,
        "userContent": user_content,
        "outputSchema": workflow.output_schema.model_json_schema(),
        "maxOutputTokens": settings.AI_MAX_OUTPUT_TOKENS[job.run.intelligence],
    }


@transaction.atomic
def complete_job(
    *,
    connector: LocalConnector,
    run_id: UUID,
    output: dict | None,
    input_tokens: int | None,
    output_tokens: int | None,
    error_code: str | None,
) -> WorkflowRun:
    job = (
        LocalConnectorJob.objects.select_for_update()
        .select_related("run")
        .filter(connector=connector, run_id=run_id)
        .first()
    )
    if job is None:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That connector job was not found.",
            status=404,
        )
    if job.status in {LocalConnectorJob.Status.COMPLETED, LocalConnectorJob.Status.FAILED}:
        return job.run
    if job.status != LocalConnectorJob.Status.LEASED:
        raise OpsPilotError(
            code="CONNECTOR_JOB_NOT_CLAIMED",
            message="Claim this connector job before completing it.",
            status=409,
            retryable=True,
        )
    if error_code:
        _fail_job(job, error_code)
        return job.run
    workflow = get_workflow(job.run.workflow_id)
    if workflow is None or output is None:
        _fail_job(job, "INVALID_AI_OUTPUT")
        return job.run
    job.run.execution_phase = WorkflowRun.ExecutionPhase.VALIDATING
    job.run.save(update_fields=["execution_phase"])
    try:
        validated = workflow.output_schema.model_validate(output).model_dump(
            mode="json", by_alias=True
        )
    except ValidationError:
        _fail_job(job, "INVALID_AI_OUTPUT")
        return job.run
    job.run.execution_phase = WorkflowRun.ExecutionPhase.SAVING
    job.run.save(update_fields=["execution_phase"])
    now = timezone.now()
    job.run.status = WorkflowRun.Status.COMPLETED
    job.run.execution_phase = WorkflowRun.ExecutionPhase.COMPLETED
    job.run.result_json = validated
    job.run.input_tokens = input_tokens
    job.run.output_tokens = output_tokens
    job.run.duration_ms = max(0, round((now - job.run.created_at).total_seconds() * 1000))
    job.run.completed_at = now
    job.run.save(
        update_fields=[
            "status",
            "execution_phase",
            "result_json",
            "input_tokens",
            "output_tokens",
            "duration_ms",
            "completed_at",
        ]
    )
    job.status = LocalConnectorJob.Status.COMPLETED
    job.lease_expires_at = None
    job.save(update_fields=["status", "lease_expires_at", "updated_at"])
    return job.run


def _fail_job(job: LocalConnectorJob, code: str) -> None:
    now = timezone.now()
    job.status = LocalConnectorJob.Status.FAILED
    job.lease_expires_at = None
    job.save(update_fields=["status", "lease_expires_at", "updated_at"])
    job.run.status = WorkflowRun.Status.FAILED
    job.run.execution_phase = WorkflowRun.ExecutionPhase.FAILED
    job.run.error_code = code
    job.run.duration_ms = max(0, round((now - job.run.created_at).total_seconds() * 1000))
    job.run.completed_at = now
    job.run.save(
        update_fields=[
            "status",
            "execution_phase",
            "error_code",
            "duration_ms",
            "completed_at",
        ]
    )
