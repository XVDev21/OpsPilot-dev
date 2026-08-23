from uuid import UUID

from django.conf import settings
from ninja import Query, Router, Schema, Status
from pydantic import Field, ValidationError

from cases.selectors import case_for_user
from common.errors import OpsPilotError
from runs.schemas import CreateWorkflowRunRequest, RunListResponse, WorkflowRunSchema
from runs.selectors import run_for_user, runs_for_user
from runs.services import delete_run, execute_workflow_run
from workflows.registry import get_workflow
from workitems.services import complete_run_handoff, handoff_for_user, validate_run_handoff

router = Router(tags=["runs"])
PAGE_SIZE = 20


class RunListQuery(Schema):
    page: int = Field(default=1, ge=1, le=10_000)


def input_field_errors(exc: ValidationError) -> dict[str, list[str]]:
    errors: dict[str, list[str]] = {}
    for item in exc.errors():
        path = ".".join(str(part) for part in item.get("loc", ()))
        field = f"input.{path}" if path else "input"
        errors.setdefault(field, []).append(str(item.get("msg", "Invalid value.")))
    return errors


@router.post(
    "/workflows/{workflow_id}/runs",
    response={201: WorkflowRunSchema, 202: WorkflowRunSchema},
    summary="Execute a workflow",
)
def create_run(request, workflow_id: str, payload: CreateWorkflowRunRequest):
    workflow = get_workflow(workflow_id)
    if workflow is None:
        raise OpsPilotError(
            code="UNKNOWN_WORKFLOW",
            message="That workflow is not available.",
            status=404,
        )

    try:
        validated_input = workflow.input_schema.model_validate(payload.input)
    except ValidationError as exc:
        raise OpsPilotError(
            code="VALIDATION_ERROR",
            message="Review the highlighted workflow input and try again.",
            status=422,
            field_errors=input_field_errors(exc),
        ) from exc

    options = payload.options
    provider = options.provider if options and options.provider else settings.AI_DEFAULT_PROVIDER
    intelligence = (
        options.intelligence
        if options and options.intelligence
        else settings.AI_DEFAULT_INTELLIGENCE
    )
    validate_run_handoff(
        user=request.auth.user,
        handoff_id=payload.handoffId,
        workflow_id=workflow_id,
    )
    case = case_for_user(user=request.auth.user, case_id=payload.caseId) if payload.caseId else None
    if payload.handoffId:
        handoff = handoff_for_user(user=request.auth.user, handoff_id=payload.handoffId)
        if case is not None and handoff.case_id and handoff.case_id != case.id:
            raise OpsPilotError(
                code="CASE_CONTEXT_MISMATCH",
                message="That workflow draft belongs to another operations case.",
                status=422,
            )
        if case is None:
            case = handoff.case
    run = execute_workflow_run(
        user=request.auth.user,
        workflow=workflow,
        validated_input=validated_input,
        provider_name=provider,
        intelligence=intelligence,
        case=case,
    )
    complete_run_handoff(
        user=request.auth.user,
        handoff_id=payload.handoffId,
        workflow_id=workflow_id,
        run=run,
    )
    return Status(202 if run.status == "pending" else 201, run)


@router.get("/runs", response=RunListResponse, summary="Workflow run history")
def list_runs(request, query: Query[RunListQuery]):
    start = (query.page - 1) * PAGE_SIZE
    records = list(runs_for_user(request.auth.user)[start : start + PAGE_SIZE + 1])
    has_next_page = len(records) > PAGE_SIZE
    return {
        "items": records[:PAGE_SIZE],
        "next_cursor": str(query.page + 1) if has_next_page else None,
    }


@router.get("/runs/{run_id}", response=WorkflowRunSchema, summary="Workflow run detail")
def get_run(request, run_id: UUID):
    return run_for_user(user=request.auth.user, run_id=run_id)


@router.delete("/runs/{run_id}", response={204: None}, summary="Delete workflow run")
def remove_run(request, run_id: UUID):
    delete_run(user=request.auth.user, run_id=run_id)
    return Status(204, None)
