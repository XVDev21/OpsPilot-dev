from uuid import UUID

from django.db.models import Q
from ninja import Query, Router, Status

from cases.models import WorkspaceMember
from cases.presenters import case_detail_dict, case_summary_dict, member_dict
from cases.schemas import (
    CaseDetailSchema,
    CaseListQuery,
    CaseListResponse,
    CreateCaseInput,
    UpdateCaseAssignmentInput,
    UpdateCaseInput,
    WorkspaceMemberList,
)
from cases.selectors import case_for_user, cases_for_user
from cases.services import assign_case, create_case, ensure_personal_workspace, update_case

router = Router(tags=["operations cases"])


@router.get(
    "/workspace/members",
    response=WorkspaceMemberList,
    summary="Personal workspace members",
)
def list_workspace_members(request):
    workspace = ensure_personal_workspace(request.auth.user)
    members = WorkspaceMember.objects.filter(workspace=workspace, is_active=True)
    return {"items": [member_dict(member) for member in members]}


@router.get("/cases", response=CaseListResponse, summary="Operations cases")
def list_cases(request, query: Query[CaseListQuery]):
    records = cases_for_user(request.auth.user)
    if query.status:
        records = records.filter(status=query.status)
    if query.disposition:
        records = records.filter(disposition=query.disposition)
    if query.assigneeId:
        records = records.filter(assignment__assignee_id=query.assigneeId)
    if query.search:
        records = records.filter(
            Q(title__icontains=query.search)
            | Q(summary__icontains=query.search)
            | Q(description__icontains=query.search)
        )
    total = records.count()
    start = (query.page - 1) * query.pageSize
    page_records = list(records[start : start + query.pageSize])
    return {
        "items": [case_summary_dict(case) for case in page_records],
        "page": query.page,
        "pageSize": query.pageSize,
        "total": total,
        "hasMore": start + len(page_records) < total,
    }


@router.post(
    "/cases",
    response={201: CaseDetailSchema},
    summary="Create an operations case",
)
def post_case(request, payload: CreateCaseInput):
    case = create_case(
        user=request.auth.user,
        title=payload.title,
        description=payload.description,
        summary=payload.summary,
        disposition=payload.disposition,
        due_date=payload.dueDate,
        assignee_id=payload.assigneeId,
    )
    return Status(201, case_detail_dict(case))


@router.get("/cases/{case_id}", response=CaseDetailSchema, summary="Operations case detail")
def get_case(request, case_id: UUID):
    return case_detail_dict(case_for_user(user=request.auth.user, case_id=case_id, detail=True))


@router.patch(
    "/cases/{case_id}",
    response=CaseDetailSchema,
    summary="Update an operations case",
)
def patch_case(request, case_id: UUID, payload: UpdateCaseInput):
    case = update_case(
        user=request.auth.user,
        case_id=case_id,
        status=payload.status,
        disposition=payload.disposition,
        confidence=payload.confidence,
        confidence_supplied="confidence" in payload.model_fields_set,
        due_date=payload.dueDate,
        due_date_supplied="dueDate" in payload.model_fields_set,
        resolution_summary=payload.resolutionSummary,
    )
    return case_detail_dict(case)


@router.put(
    "/cases/{case_id}/assignment",
    response=CaseDetailSchema,
    summary="Assign an operations case",
)
def put_case_assignment(request, case_id: UUID, payload: UpdateCaseAssignmentInput):
    return case_detail_dict(
        assign_case(
            user=request.auth.user,
            case_id=case_id,
            assignee_id=payload.assigneeId,
        )
    )
