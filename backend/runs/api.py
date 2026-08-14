from uuid import UUID

from ninja import Query, Router, Schema, Status
from pydantic import Field

from runs.schemas import RunListResponse, WorkflowRunSchema
from runs.selectors import run_for_user, runs_for_user
from runs.services import delete_run

router = Router(tags=["runs"])
PAGE_SIZE = 20


class RunListQuery(Schema):
    page: int = Field(default=1, ge=1, le=10_000)


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
