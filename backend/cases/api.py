from uuid import UUID

from django.db.models import Q
from django.http import FileResponse
from ninja import File, Query, Router, Status, UploadedFile

from cases.assessments import apply_assessment, run_case_assessment
from cases.evidence import (
    add_image_evidence,
    add_text_evidence,
    evidence_for_user,
    remove_evidence,
)
from cases.models import WorkspaceMember
from cases.presenters import case_detail_dict, case_summary_dict, evidence_dict, member_dict
from cases.schemas import (
    CaseDetailSchema,
    CaseEvidenceSchema,
    CaseListQuery,
    CaseListResponse,
    CreateAssessmentInput,
    CreateCaseInput,
    CreateTextEvidenceInput,
    PublishCaseInput,
    UpdateCaseAssignmentInput,
    UpdateCaseInput,
    WorkspaceMemberList,
)
from cases.selectors import case_for_user, cases_for_user
from cases.services import (
    assign_case,
    create_case,
    ensure_personal_workspace,
    publish_case,
    update_case,
)
from runs.schemas import WorkflowRunSchema

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
    if query.intent:
        records = records.filter(intent=query.intent)
    if query.publicationState:
        records = records.filter(publication_state=query.publicationState)
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
        intent=payload.intent,
        affected_area=payload.affectedArea,
        expected_outcome=payload.expectedOutcome,
        environment_context=payload.environmentContext,
        settings_context=payload.settingsContext,
        constraints=payload.constraints,
        evidence_notes=payload.evidenceNotes,
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
        publication_state=payload.publicationState,
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


@router.post(
    "/cases/{case_id}/publish",
    response=CaseDetailSchema,
    summary="Publish an operations case",
)
def post_case_publish(request, case_id: UUID, payload: PublishCaseInput):
    return case_detail_dict(
        publish_case(
            user=request.auth.user,
            case_id=case_id,
            assignee_id=payload.assigneeId,
        )
    )


@router.post(
    "/cases/{case_id}/evidence/text",
    response={201: CaseEvidenceSchema},
    summary="Add text evidence",
)
def post_case_text_evidence(request, case_id: UUID, payload: CreateTextEvidenceInput):
    evidence = add_text_evidence(user=request.auth.user, case_id=case_id, text=payload.text)
    return Status(201, evidence_dict(evidence))


@router.post(
    "/cases/{case_id}/evidence/images",
    response={201: CaseEvidenceSchema},
    summary="Upload private image evidence",
)
def post_case_image_evidence(
    request,
    case_id: UUID,
    file: File[UploadedFile],
    caption: str = "",
):
    evidence = add_image_evidence(
        user=request.auth.user,
        case_id=case_id,
        uploaded_file=file,
        caption=caption,
    )
    return Status(201, evidence_dict(evidence))


@router.get(
    "/cases/{case_id}/evidence/{evidence_id}/content",
    summary="Download private image evidence",
)
def get_case_evidence_content(request, case_id: UUID, evidence_id: UUID):
    evidence = evidence_for_user(
        user=request.auth.user,
        case_id=case_id,
        evidence_id=evidence_id,
    )
    if not evidence.file:
        from common.errors import OpsPilotError

        raise OpsPilotError(
            code="NOT_FOUND",
            message="That evidence item does not contain an image.",
            status=404,
        )
    response = FileResponse(
        evidence.file.open("rb"),
        content_type=evidence.mime_type or "application/octet-stream",
        as_attachment=False,
        filename=evidence.original_filename or "case-evidence",
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


@router.delete(
    "/cases/{case_id}/evidence/{evidence_id}",
    response={204: None},
    summary="Remove case evidence",
)
def delete_case_evidence(request, case_id: UUID, evidence_id: UUID):
    remove_evidence(user=request.auth.user, case_id=case_id, evidence_id=evidence_id)
    return Status(204, None)


@router.post(
    "/cases/{case_id}/assessments",
    response={201: WorkflowRunSchema, 202: WorkflowRunSchema},
    summary="Run a versioned case assessment",
)
def post_case_assessment(request, case_id: UUID, payload: CreateAssessmentInput):
    run = run_case_assessment(
        user=request.auth.user,
        case_id=case_id,
        provider_name=payload.provider,
        intelligence=payload.intelligence,
    )
    return Status(202 if run.status == "pending" else 201, run)


@router.post(
    "/cases/{case_id}/assessments/{assessment_id}/apply",
    response=CaseDetailSchema,
    summary="Apply a reviewed case assessment",
)
def post_apply_case_assessment(request, case_id: UUID, assessment_id: UUID):
    return case_detail_dict(
        apply_assessment(
            user=request.auth.user,
            case_id=case_id,
            assessment_id=assessment_id,
        )
    )
