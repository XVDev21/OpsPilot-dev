import hashlib
from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone

from accounts.models import AppUser
from cases.evidence import _invalid_image, _normalize_image
from cases.models import (
    CaseEvent,
    CaseEvidence,
    CaseUpdate,
    CaseUpdateAttachment,
    OperationsCase,
    Workspace,
)
from cases.selectors import acting_member, case_for_user, require_case_manager
from cases.services import record_case_event, record_domain_event
from common.errors import OpsPilotError
from workitems.models import WorkItem


def _can_contribute(*, user: AppUser, case: OperationsCase) -> None:
    member = acting_member(user=user, workspace_id=case.workspace_id)
    if member.access_role in {member.AccessRole.OWNER, member.AccessRole.OPERATOR}:
        return
    assignment = getattr(case, "assignment", None)
    if (
        member.access_role == member.AccessRole.CONTRIBUTOR
        and assignment
        and assignment.assignee_id == member.id
    ):
        return
    raise OpsPilotError(
        code="CASE_CONTRIBUTOR_REQUIRED",
        message="Only case managers or the assigned contributor can post updates.",
        status=403,
    )


@transaction.atomic
def create_case_update(
    *,
    user: AppUser,
    case_id: UUID,
    update_type: str,
    body: str,
    client_request_id: UUID,
    task_id: UUID | None = None,
    external_links: list[dict] | None = None,
    verification_result: str = "",
) -> CaseUpdate:
    case = case_for_user(user=user, case_id=case_id, detail=True, for_update=True)
    if case.publication_state != OperationsCase.PublicationState.PUBLISHED:
        raise OpsPilotError(
            code="CASE_NOT_PUBLISHED",
            message="Publish this case before posting delivery updates.",
            status=409,
        )
    _can_contribute(user=user, case=case)
    existing = CaseUpdate.objects.filter(
        case=case,
        client_request_id=client_request_id,
    ).first()
    if existing is not None:
        return existing
    if update_type == CaseUpdate.Type.VERIFICATION:
        require_case_manager(user=user, case=case)
        if verification_result not in CaseUpdate.VerificationResult.values:
            raise OpsPilotError(
                code="VERIFICATION_RESULT_REQUIRED",
                message="Record whether verification passed or failed.",
                status=422,
            )
    elif verification_result:
        raise OpsPilotError(
            code="INVALID_VERIFICATION_RESULT",
            message="A verification result is only valid for a verification update.",
            status=422,
        )
    task = None
    if task_id is not None:
        task = WorkItem.objects.filter(id=task_id, case=case).first()
        if task is None:
            raise OpsPilotError(
                code="INVALID_CASE_TASK",
                message="Choose a task that belongs to this case.",
                status=422,
            )
    member = acting_member(user=user, workspace_id=case.workspace_id)
    update = CaseUpdate.objects.create(
        case=case,
        author=user,
        author_member=member,
        task=task,
        update_type=update_type,
        body=body,
        external_links=external_links or [],
        verification_result=verification_result,
        client_request_id=client_request_id,
    )
    record_case_event(
        case=case,
        event_type=CaseEvent.Type.UPDATE_ADDED,
        actor=user,
        payload={
            "updateId": str(update.id),
            "updateType": update.update_type,
            "taskId": str(task.id) if task else None,
        },
    )
    if update_type == CaseUpdate.Type.RESOLUTION:
        case.resolution_summary = body
        if case.status not in {OperationsCase.Status.RESOLVED, OperationsCase.Status.CLOSED}:
            case.status = OperationsCase.Status.VERIFICATION
        record_domain_event(
            case=case,
            event_type="case.resolution.proposed",
            actor=user,
            payload={"updateId": str(update.id)},
        )
    elif update_type == CaseUpdate.Type.BLOCKER:
        if case.status not in {OperationsCase.Status.RESOLVED, OperationsCase.Status.CLOSED}:
            case.status = OperationsCase.Status.ACTION_REQUIRED
        record_domain_event(
            case=case,
            event_type="case.blocked",
            actor=user,
            payload={"updateId": str(update.id)},
        )
    elif update_type == CaseUpdate.Type.VERIFICATION:
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.VERIFICATION_RECORDED,
            actor=user,
            payload={"result": verification_result, "updateId": str(update.id)},
        )
        if verification_result == CaseUpdate.VerificationResult.PASSED:
            case.status = OperationsCase.Status.RESOLVED
            case.resolved_at = timezone.now()
        else:
            case.status = OperationsCase.Status.IN_PROGRESS
            case.resolved_at = None
        record_domain_event(
            case=case,
            event_type=f"case.verification.{verification_result}",
            actor=user,
            payload={"updateId": str(update.id)},
        )
    case.save(update_fields=["status", "resolution_summary", "resolved_at", "updated_at"])
    return update


@transaction.atomic
def add_update_image(
    *,
    user: AppUser,
    case_id: UUID,
    update_id: UUID,
    uploaded_file,
) -> CaseUpdateAttachment:
    if not settings.CASE_EVIDENCE_UPLOADS_ENABLED:
        raise OpsPilotError(
            code="UPDATE_UPLOADS_UNAVAILABLE",
            message="Private update storage is not configured for this environment.",
            status=503,
        )
    case = case_for_user(user=user, case_id=case_id, detail=True, for_update=True)
    _can_contribute(user=user, case=case)
    update = CaseUpdate.objects.filter(id=update_id, case=case).first()
    if update is None:
        raise OpsPilotError(code="NOT_FOUND", message="That case update was not found.", status=404)
    if update.attachments.count() >= 8:
        raise OpsPilotError(
            code="UPDATE_ATTACHMENT_LIMIT_REACHED",
            message="A case update can contain up to 8 images.",
            status=409,
        )
    if uploaded_file.size is None or uploaded_file.size <= 0:
        raise _invalid_image("Choose a non-empty JPEG, PNG, or WebP image.")
    if uploaded_file.size > settings.CASE_EVIDENCE_MAX_BYTES:
        raise _invalid_image("The update image exceeded the private image size limit.")
    source = uploaded_file.read(settings.CASE_EVIDENCE_MAX_BYTES + 1)
    normalized, mime_type, extension, width, height = _normalize_image(source)
    if len(normalized) > settings.CASE_EVIDENCE_MAX_BYTES:
        raise _invalid_image("The normalized update image exceeded the private image size limit.")
    Workspace.objects.select_for_update().only("id").get(id=case.workspace_id)
    evidence_bytes = (
        CaseEvidence.objects.filter(case__workspace_id=case.workspace_id).aggregate(
            total=Sum("byte_size")
        )["total"]
        or 0
    )
    update_bytes = (
        CaseUpdateAttachment.objects.filter(update__case__workspace_id=case.workspace_id).aggregate(
            total=Sum("byte_size")
        )["total"]
        or 0
    )
    if evidence_bytes + update_bytes + len(normalized) > settings.CASE_EVIDENCE_MAX_WORKSPACE_BYTES:
        raise OpsPilotError(
            code="UPDATE_STORAGE_LIMIT_REACHED",
            message="This workspace has reached its private image storage allowance.",
            status=409,
        )
    attachment = CaseUpdateAttachment(
        update=update,
        original_filename=Path(uploaded_file.name or "update-image").name[:255],
        mime_type=mime_type,
        byte_size=len(normalized),
        width=width,
        height=height,
        sha256=hashlib.sha256(normalized).hexdigest(),
    )
    try:
        attachment.file.save(f"update{extension}", ContentFile(normalized), save=False)
        attachment.save()
    except Exception:
        if attachment.file and attachment.file.name:
            attachment.file.storage.delete(attachment.file.name)
        raise
    case.save(update_fields=["updated_at"])
    return attachment


def attachment_for_user(
    *, user: AppUser, case_id: UUID, attachment_id: UUID
) -> CaseUpdateAttachment:
    attachment = (
        CaseUpdateAttachment.objects.select_related("update__case__workspace")
        .filter(
            id=attachment_id,
            update__case_id=case_id,
            update__case__workspace__members__app_user=user,
            update__case__workspace__members__is_active=True,
        )
        .first()
    )
    if attachment is None:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That update image was not found.",
            status=404,
        )
    return attachment
