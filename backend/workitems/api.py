from uuid import UUID

from ninja import Query, Router, Status

from workitems.models import WorkItem
from workitems.schemas import (
    CreateHandoffInput,
    CreateWorkItemInput,
    UpdateWorkItemInput,
    WorkflowHandoffSchema,
    WorkItemList,
    WorkItemListQuery,
    WorkItemSchema,
)
from workitems.services import (
    create_handoff,
    create_work_item,
    get_handoff,
    update_work_item,
)

router = Router(tags=["work items"])


def work_item_response(item: WorkItem) -> dict:
    return {
        "id": item.id,
        "caseId": item.case_id,
        "title": item.title,
        "description": item.description,
        "kind": item.kind,
        "status": item.status,
        "assigneeId": item.assignee_id,
        "assigneeKey": item.assignee.key if item.assignee else None,
        "assigneeName": item.assignee.name if item.assignee else None,
        "dueDate": item.due_date,
        "blockerReason": item.blocker_reason,
        "completedAt": item.completed_at,
        "sourceRunId": item.source_run_id,
        "sourceHandoffId": item.source_handoff_id,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


@router.post(
    "/runs/{run_id}/handoffs",
    response={201: WorkflowHandoffSchema},
    summary="Create a reviewed workflow draft",
)
def post_handoff(request, run_id: UUID, payload: CreateHandoffInput):
    return Status(201, create_handoff(user=request.auth.user, run_id=run_id, target=payload.target))


@router.get(
    "/handoffs/{handoff_id}",
    response=WorkflowHandoffSchema,
    summary="Get a workflow handoff draft",
)
def get_workflow_handoff(request, handoff_id: UUID):
    return get_handoff(user=request.auth.user, handoff_id=handoff_id)


@router.get("/work-items", response=WorkItemList, summary="Personal work items")
def list_work_items(request, query: Query[WorkItemListQuery]):
    items = WorkItem.objects.filter(user=request.auth.user).select_related("assignee")
    if query.status:
        items = items.filter(status=query.status)
    if query.assigneeId:
        items = items.filter(assignee_id=query.assigneeId)
    if query.caseId:
        items = items.filter(case_id=query.caseId)
    return {"items": [work_item_response(item) for item in items]}


@router.post("/work-items", response={201: WorkItemSchema}, summary="Create a work item")
def post_work_item(request, payload: CreateWorkItemInput):
    item = create_work_item(
        user=request.auth.user,
        handoff_id=payload.handoffId,
        case_id=payload.caseId,
        title=payload.title,
        description=payload.description,
        kind=payload.kind,
        assignee_id=payload.assigneeId,
        due_date=payload.dueDate,
    )
    return Status(201, work_item_response(item))


@router.patch(
    "/work-items/{item_id}",
    response=WorkItemSchema,
    summary="Update a work item state",
)
def patch_work_item(request, item_id: UUID, payload: UpdateWorkItemInput):
    item = update_work_item(
        user=request.auth.user,
        item_id=item_id,
        status=payload.status,
        assignee_id=payload.assigneeId,
        assignee_supplied="assigneeId" in payload.model_fields_set,
        due_date=payload.dueDate,
        due_date_supplied="dueDate" in payload.model_fields_set,
        blocker_reason=payload.blockerReason,
        blocker_reason_supplied="blockerReason" in payload.model_fields_set,
    )
    return work_item_response(item)
