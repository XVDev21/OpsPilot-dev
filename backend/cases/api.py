from uuid import UUID

from django.db.models import Q
from django.http import FileResponse
from ninja import File, Query, Router, Status, UploadedFile

from cases.assessments import apply_assessment, run_case_assessment
from cases.collaboration import (
    activate_collaboration,
    invite_workspace_member,
    process_workos_event,
    reconcile_workspace,
    resend_workspace_invitation,
    revoke_workspace_invitation,
    update_workspace_member,
    workspace_context,
    workspace_invitations,
    workspace_members,
)
from cases.delivery import (
    add_update_image,
    attachment_for_user,
    create_case_update,
)
from cases.evidence import (
    add_image_evidence,
    add_text_evidence,
    evidence_for_user,
    remove_evidence,
)
from cases.notifications import (
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    notification_preferences,
    process_resend_webhook,
    update_notification_preferences,
)
from cases.presenters import (
    case_detail_dict,
    case_summary_dict,
    case_update_dict,
    evidence_dict,
    invitation_dict,
    roster_member_dict,
)
from cases.schemas import (
    ActivateCollaborationInput,
    CaseDetailSchema,
    CaseEvidenceSchema,
    CaseListQuery,
    CaseListResponse,
    CaseUpdateAttachmentSchema,
    CaseUpdateSchema,
    CreateAssessmentInput,
    CreateCaseInput,
    CreateCaseUpdateInput,
    CreateTextEvidenceInput,
    InviteWorkspaceMemberInput,
    NotificationListQuery,
    NotificationListSchema,
    NotificationPreferencesSchema,
    NotificationSchema,
    PublishCaseInput,
    UpdateCaseAssignmentInput,
    UpdateCaseInput,
    UpdateNotificationPreferencesInput,
    UpdateWorkspaceMemberInput,
    WorkspaceContextSchema,
    WorkspaceInvitationList,
    WorkspaceInvitationSchema,
    WorkspaceMemberList,
    WorkspaceReconciliationSchema,
    WorkspaceRosterMemberSchema,
)
from cases.selectors import case_for_user, cases_for_user
from cases.services import (
    assign_case,
    create_case,
    publish_case,
    update_case,
)
from cases.workos_directory import get_workos_directory
from runs.schemas import WorkflowRunSchema

router = Router(tags=["operations cases"])


def _event_preference_fields(value) -> dict[str, bool | None]:
    return {
        "assignment_email": value.assignment,
        "blocker_email": value.blocker,
        "mention_email": value.mention,
        "resolution_email": value.resolution,
        "verification_email": value.verification,
        "due_date_email": value.dueDate,
    }


@router.get("/notifications", response=NotificationListSchema, summary="Notification inbox")
def get_notifications(request, query: Query[NotificationListQuery]):
    return list_notifications(
        user=request.auth.user,
        unread_only=query.unreadOnly,
        limit=query.limit,
    )


@router.patch(
    "/notifications/{notification_id}/read",
    response=NotificationSchema,
    summary="Mark a notification as read",
)
def patch_notification_read(request, notification_id: UUID):
    return mark_notification_read(user=request.auth.user, notification_id=notification_id)


@router.post("/notifications/read-all", response=dict, summary="Mark all notifications read")
def post_notifications_read_all(request):
    return {"updated": mark_all_notifications_read(user=request.auth.user)}


@router.get(
    "/notification-preferences",
    response=NotificationPreferencesSchema,
    summary="Notification preferences",
)
def get_notification_preferences(request):
    return notification_preferences(user=request.auth.user)


@router.put(
    "/notification-preferences",
    response=NotificationPreferencesSchema,
    summary="Update notification preferences",
)
def put_notification_preferences(request, payload: UpdateNotificationPreferencesInput):
    workspace_defaults = None
    if payload.workspaceDefaults is not None:
        workspace_defaults = {
            "email_enabled": payload.workspaceDefaults.emailEnabled,
            **_event_preference_fields(payload.workspaceDefaults),
        }
    return update_notification_preferences(
        user=request.auth.user,
        email_enabled=payload.emailEnabled,
        event_overrides=(
            _event_preference_fields(payload.eventOverrides)
            if payload.eventOverrides is not None
            else {}
        ),
        workspace_defaults=workspace_defaults,
    )


@router.post("/resend/events", auth=None, response=dict, summary="Receive signed Resend events")
def post_resend_event(request):
    processed = process_resend_webhook(
        payload=request.body,
        headers={
            "svix-id": request.headers.get("svix-id", ""),
            "svix-timestamp": request.headers.get("svix-timestamp", ""),
            "svix-signature": request.headers.get("svix-signature", ""),
        },
    )
    return {"received": True, "processed": processed}


@router.get("/workspace", response=WorkspaceContextSchema, summary="Current workspace context")
def get_workspace_context(request):
    return workspace_context(request.auth.user)


@router.post(
    "/workspace/collaboration",
    response=WorkspaceContextSchema,
    summary="Enable WorkOS workspace collaboration",
)
def post_workspace_collaboration(request, payload: ActivateCollaborationInput):
    activate_collaboration(user=request.auth.user, name=payload.name)
    return workspace_context(request.auth.user)


@router.get(
    "/workspace/members",
    response=WorkspaceMemberList,
    summary="Personal workspace members",
)
def list_workspace_members(request):
    members = workspace_members(request.auth.user)
    return {"items": [roster_member_dict(member) for member in members]}


@router.patch(
    "/workspace/members/{member_id}",
    response=WorkspaceRosterMemberSchema,
    summary="Update a workspace member",
)
def patch_workspace_member(request, member_id: UUID, payload: UpdateWorkspaceMemberInput):
    return roster_member_dict(
        update_workspace_member(
            user=request.auth.user,
            member_id=member_id,
            access_role=payload.accessRole,
            active=payload.active,
        )
    )


@router.get(
    "/workspace/invitations",
    response=WorkspaceInvitationList,
    summary="Workspace invitations",
)
def list_workspace_invitations(request):
    return {
        "items": [
            invitation_dict(invitation) for invitation in workspace_invitations(request.auth.user)
        ]
    }


@router.post(
    "/workspace/invitations",
    response={201: WorkspaceInvitationSchema},
    summary="Invite a workspace member",
)
def post_workspace_invitation(request, payload: InviteWorkspaceMemberInput):
    invitation = invite_workspace_member(
        user=request.auth.user,
        email=payload.email,
        access_role=payload.accessRole,
        target_member_id=payload.targetMemberId,
    )
    return Status(201, invitation_dict(invitation))


@router.post(
    "/workspace/invitations/{invitation_id}/revoke",
    response=WorkspaceInvitationSchema,
    summary="Revoke a workspace invitation",
)
def post_revoke_workspace_invitation(request, invitation_id: UUID):
    return invitation_dict(
        revoke_workspace_invitation(user=request.auth.user, invitation_id=invitation_id)
    )


@router.post(
    "/workspace/invitations/{invitation_id}/resend",
    response=WorkspaceInvitationSchema,
    summary="Resend a workspace invitation",
)
def post_resend_workspace_invitation(request, invitation_id: UUID):
    return invitation_dict(
        resend_workspace_invitation(user=request.auth.user, invitation_id=invitation_id)
    )


@router.post(
    "/workspace/reconcile",
    response=WorkspaceReconciliationSchema,
    summary="Reconcile workspace membership with WorkOS",
)
def post_workspace_reconcile(request):
    return reconcile_workspace(user=request.auth.user)


@router.post(
    "/workos/events",
    auth=None,
    response={200: dict},
    summary="Receive signed WorkOS events",
)
def post_workos_event(request):
    event = get_workos_directory().verify_webhook(
        body=request.body,
        signature=request.headers.get("WorkOS-Signature", ""),
    )
    processed = process_workos_event(event)
    return {"received": True, "processed": processed}


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
    "/cases/{case_id}/updates",
    response={201: CaseUpdateSchema},
    summary="Post an append-only case update",
)
def post_case_update(request, case_id: UUID, payload: CreateCaseUpdateInput):
    update = create_case_update(
        user=request.auth.user,
        case_id=case_id,
        update_type=payload.type,
        body=payload.body,
        client_request_id=payload.clientRequestId,
        task_id=payload.taskId,
        external_links=[
            {"label": item.label, "url": str(item.url)} for item in payload.externalLinks
        ],
        verification_result=payload.verificationResult or "",
        mentioned_member_ids=payload.mentionedMemberIds,
    )
    return Status(201, case_update_dict(update))


@router.post(
    "/cases/{case_id}/updates/{update_id}/images",
    response={201: CaseUpdateAttachmentSchema},
    summary="Attach a private image to a case update",
)
def post_case_update_image(
    request,
    case_id: UUID,
    update_id: UUID,
    file: File[UploadedFile],
):
    attachment = add_update_image(
        user=request.auth.user,
        case_id=case_id,
        update_id=update_id,
        uploaded_file=file,
    )
    return Status(
        201,
        {
            "id": attachment.id,
            "originalFilename": attachment.original_filename,
            "mimeType": attachment.mime_type,
            "byteSize": attachment.byte_size,
            "width": attachment.width,
            "height": attachment.height,
            "downloadUrl": (f"/api/v1/cases/{case_id}/updates/attachments/{attachment.id}/content"),
        },
    )


@router.get(
    "/cases/{case_id}/updates/attachments/{attachment_id}/content",
    summary="Download a private case-update image",
)
def get_case_update_image(request, case_id: UUID, attachment_id: UUID):
    attachment = attachment_for_user(
        user=request.auth.user,
        case_id=case_id,
        attachment_id=attachment_id,
    )
    response = FileResponse(
        attachment.file.open("rb"),
        content_type=attachment.mime_type,
        as_attachment=False,
        filename=attachment.original_filename,
    )
    response["Cache-Control"] = "private, no-store"
    response["X-Content-Type-Options"] = "nosniff"
    return response


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
            assessment_id=payload.assessmentId,
            override_advisory=payload.overrideAdvisory,
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
