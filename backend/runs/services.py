import logging
from datetime import timedelta
from time import monotonic
from uuid import UUID

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from pydantic import BaseModel, ValidationError

from accounts.models import AppUser
from ai.prompts import compile_prompt
from ai.providers.registry import get_provider, max_output_tokens_for, model_for
from ai.types import AIProvider, IntelligenceLevel, ProviderFailure, ProviderName
from common.errors import OpsPilotError
from integrations.services import mark_credential_used
from runs.models import WorkflowRun
from runs.selectors import run_for_user
from workflows.registry import WorkflowDefinition

logger = logging.getLogger(__name__)


@transaction.atomic
def reserve_run(
    *,
    user: AppUser,
    workflow: WorkflowDefinition,
    input_json: dict,
    provider_name: ProviderName,
    intelligence: IntelligenceLevel,
    model: str,
) -> WorkflowRun:
    locked_user = AppUser.objects.select_for_update().get(pk=user.pk)
    now = timezone.now()
    minute_count = WorkflowRun.objects.filter(
        user=locked_user, created_at__gte=now - timedelta(minutes=1)
    ).count()
    day_count = WorkflowRun.objects.filter(
        user=locked_user, created_at__gte=now - timedelta(days=1)
    ).count()
    if (
        minute_count >= settings.AI_RATE_LIMIT_PER_MINUTE
        or day_count >= settings.AI_RATE_LIMIT_PER_DAY
    ):
        raise OpsPilotError(
            code="RUN_RATE_LIMITED",
            message="You have reached the live workflow limit. Try again later.",
            status=429,
            retryable=True,
        )
    return WorkflowRun.objects.create(
        user=locked_user,
        workflow_id=workflow.id,
        status=WorkflowRun.Status.PENDING,
        input_json=input_json,
        provider=provider_name,
        model=model,
        intelligence=intelligence,
        prompt_version=workflow.prompt_version,
        expires_at=now + timedelta(days=settings.WORKFLOW_RETENTION_DAYS),
    )


def finish_failed_run(*, run: WorkflowRun, code: str, started_at: float) -> None:
    run.status = WorkflowRun.Status.FAILED
    run.error_code = code
    run.duration_ms = max(0, round((monotonic() - started_at) * 1000))
    run.completed_at = timezone.now()
    run.save(update_fields=["status", "error_code", "duration_ms", "completed_at"])


def execute_workflow_run(
    *,
    user: AppUser,
    workflow: WorkflowDefinition,
    validated_input: BaseModel,
    provider_name: ProviderName,
    intelligence: IntelligenceLevel,
    provider: AIProvider | None = None,
) -> WorkflowRun:
    model = model_for(provider_name, intelligence)
    input_json = validated_input.model_dump(mode="json", by_alias=True)
    run = reserve_run(
        user=user,
        workflow=workflow,
        input_json=input_json,
        provider_name=provider_name,
        intelligence=intelligence,
        model=model,
    )
    started_at = monotonic()

    try:
        if provider is None:
            resolved_provider = get_provider(provider=provider_name, user=user)
            active_provider = resolved_provider.adapter
            run.credential_source = resolved_provider.credential_source
            run.save(update_fields=["credential_source"])
            mark_credential_used(resolved_provider.credential_id)
        else:
            active_provider = provider
            run.credential_source = "platform"
            run.save(update_fields=["credential_source"])
        system_instruction, user_content = compile_prompt(
            workflow=workflow, validated_input=validated_input
        )
        provider_result = active_provider.generate_structured(
            model=model,
            system_instruction=system_instruction,
            user_content=user_content,
            output_schema=workflow.output_schema,
            max_output_tokens=max_output_tokens_for(intelligence),
        )
        output = workflow.output_schema.model_validate(provider_result.output).model_dump(
            mode="json", by_alias=True
        )
    except ProviderFailure as exc:
        finish_failed_run(run=run, code=exc.code, started_at=started_at)
        raise OpsPilotError(
            code=exc.code,
            message=exc.message,
            status=exc.status,
            retryable=exc.retryable,
        ) from exc
    except ValidationError as exc:
        finish_failed_run(run=run, code="INVALID_AI_OUTPUT", started_at=started_at)
        raise OpsPilotError(
            code="INVALID_AI_OUTPUT",
            message="The AI provider returned a result that could not be validated.",
            status=502,
            retryable=True,
        ) from exc
    except Exception as exc:
        finish_failed_run(run=run, code="AI_UNAVAILABLE", started_at=started_at)
        logger.exception("Unexpected provider failure run_id=%s", run.id)
        raise OpsPilotError(
            code="AI_UNAVAILABLE",
            message="The AI provider is temporarily unavailable.",
            status=503,
            retryable=True,
        ) from exc

    run.status = WorkflowRun.Status.COMPLETED
    run.result_json = output
    run.input_tokens = provider_result.input_tokens
    run.output_tokens = provider_result.output_tokens
    run.duration_ms = max(0, round((monotonic() - started_at) * 1000))
    run.completed_at = timezone.now()
    run.save(
        update_fields=[
            "status",
            "result_json",
            "input_tokens",
            "output_tokens",
            "duration_ms",
            "completed_at",
        ]
    )
    return run


@transaction.atomic
def delete_run(*, user: AppUser, run_id: UUID) -> None:
    run_for_user(user=user, run_id=run_id).delete()
