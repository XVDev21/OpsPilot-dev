import hashlib
import io
from pathlib import Path
from uuid import UUID

from django.conf import settings
from django.core.files.base import ContentFile
from django.db import transaction
from django.db.models import Sum
from PIL import Image, ImageOps, UnidentifiedImageError

from accounts.models import AppUser
from cases.models import CaseEvent, CaseEvidence, Workspace
from cases.selectors import case_for_user
from cases.services import record_case_event
from common.errors import OpsPilotError

ALLOWED_IMAGE_FORMATS = {
    "JPEG": ("image/jpeg", ".jpg"),
    "PNG": ("image/png", ".png"),
    "WEBP": ("image/webp", ".webp"),
}


def evidence_for_user(*, user: AppUser, case_id: UUID, evidence_id: UUID) -> CaseEvidence:
    evidence = (
        CaseEvidence.objects.select_related("case__workspace")
        .filter(id=evidence_id, case_id=case_id, case__workspace__owner=user)
        .first()
    )
    if evidence is None:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That case evidence was not found.",
            status=404,
        )
    return evidence


@transaction.atomic
def add_text_evidence(*, user: AppUser, case_id: UUID, text: str) -> CaseEvidence:
    case = case_for_user(user=user, case_id=case_id, for_update=True)
    _lock_workspace(case.workspace_id)
    _enforce_evidence_item_limits(case_id=case.id, workspace_id=case.workspace_id)
    evidence = CaseEvidence.objects.create(
        case=case,
        created_by=user,
        kind=CaseEvidence.Kind.TEXT,
        text=text,
        sort_order=case.evidence.count(),
    )
    record_case_event(
        case=case,
        event_type=CaseEvent.Type.EVIDENCE_ADDED,
        actor=user,
        payload={"evidenceId": str(evidence.id), "kind": evidence.kind},
    )
    case.save(update_fields=["updated_at"])
    return evidence


@transaction.atomic
def add_image_evidence(
    *,
    user: AppUser,
    case_id: UUID,
    uploaded_file,
    caption: str = "",
) -> CaseEvidence:
    if not settings.CASE_EVIDENCE_UPLOADS_ENABLED:
        raise OpsPilotError(
            code="EVIDENCE_UPLOADS_UNAVAILABLE",
            message="Image evidence storage is not configured for this environment.",
            status=503,
        )
    case = case_for_user(user=user, case_id=case_id, for_update=True)
    _lock_workspace(case.workspace_id)
    _enforce_evidence_item_limits(case_id=case.id, workspace_id=case.workspace_id)
    if uploaded_file.size is None or uploaded_file.size <= 0:
        raise _invalid_image("Choose a non-empty JPEG, PNG, or WebP image.")
    if uploaded_file.size > settings.CASE_EVIDENCE_MAX_BYTES:
        max_mb = settings.CASE_EVIDENCE_MAX_BYTES // (1024 * 1024)
        raise _invalid_image(f"Image evidence must be {max_mb} MB or smaller.")

    source = uploaded_file.read(settings.CASE_EVIDENCE_MAX_BYTES + 1)
    if len(source) > settings.CASE_EVIDENCE_MAX_BYTES:
        raise _invalid_image("The uploaded image exceeded the evidence size limit.")
    normalized, mime_type, extension, width, height = _normalize_image(source)
    if len(normalized) > settings.CASE_EVIDENCE_MAX_BYTES:
        raise _invalid_image("The normalized image exceeded the evidence size limit.")
    _enforce_workspace_byte_limit(
        workspace_id=case.workspace_id,
        incoming_bytes=len(normalized),
    )
    digest = hashlib.sha256(normalized).hexdigest()
    evidence = CaseEvidence(
        case=case,
        created_by=user,
        kind=CaseEvidence.Kind.IMAGE,
        original_filename=Path(uploaded_file.name or "evidence").name[:255],
        caption=caption.strip()[:500],
        mime_type=mime_type,
        byte_size=len(normalized),
        width=width,
        height=height,
        sha256=digest,
        sort_order=case.evidence.count(),
    )
    try:
        evidence.file.save(f"evidence{extension}", ContentFile(normalized), save=False)
        evidence.save()
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.EVIDENCE_ADDED,
            actor=user,
            payload={
                "evidenceId": str(evidence.id),
                "kind": evidence.kind,
                "filename": evidence.original_filename,
            },
        )
        case.save(update_fields=["updated_at"])
    except Exception:
        if evidence.file and evidence.file.name:
            evidence.file.storage.delete(evidence.file.name)
        raise
    return evidence


@transaction.atomic
def remove_evidence(*, user: AppUser, case_id: UUID, evidence_id: UUID) -> None:
    case = case_for_user(user=user, case_id=case_id, for_update=True)
    evidence = evidence_for_user(user=user, case_id=case.id, evidence_id=evidence_id)
    payload = {
        "evidenceId": str(evidence.id),
        "kind": evidence.kind,
        "filename": evidence.original_filename or None,
    }
    evidence.delete()
    record_case_event(
        case=case,
        event_type=CaseEvent.Type.EVIDENCE_REMOVED,
        actor=user,
        payload=payload,
    )
    case.save(update_fields=["updated_at"])


def _lock_workspace(workspace_id: UUID) -> None:
    Workspace.objects.select_for_update().only("id").get(id=workspace_id)


def _enforce_evidence_item_limits(*, case_id: UUID, workspace_id: UUID) -> None:
    if CaseEvidence.objects.filter(case_id=case_id).count() >= settings.CASE_EVIDENCE_MAX_PER_CASE:
        raise OpsPilotError(
            code="EVIDENCE_LIMIT_REACHED",
            message=(
                f"A case can contain up to {settings.CASE_EVIDENCE_MAX_PER_CASE} evidence items."
            ),
            status=409,
        )
    if (
        CaseEvidence.objects.filter(case__workspace_id=workspace_id).count()
        >= settings.CASE_EVIDENCE_MAX_WORKSPACE_ITEMS
    ):
        raise OpsPilotError(
            code="EVIDENCE_WORKSPACE_LIMIT_REACHED",
            message="This workspace has reached its private evidence item allowance.",
            status=409,
        )


def _enforce_workspace_byte_limit(*, workspace_id: UUID, incoming_bytes: int) -> None:
    stored_bytes = (
        CaseEvidence.objects.filter(case__workspace_id=workspace_id).aggregate(
            total=Sum("byte_size")
        )["total"]
        or 0
    )
    if stored_bytes + incoming_bytes > settings.CASE_EVIDENCE_MAX_WORKSPACE_BYTES:
        raise OpsPilotError(
            code="EVIDENCE_WORKSPACE_LIMIT_REACHED",
            message="This workspace has reached its private evidence storage allowance.",
            status=409,
        )


def _normalize_image(source: bytes) -> tuple[bytes, str, str, int, int]:
    try:
        with Image.open(io.BytesIO(source)) as opened:
            image_format = opened.format
            if image_format not in ALLOWED_IMAGE_FORMATS:
                raise _invalid_image("Only JPEG, PNG, and WebP evidence images are accepted.")
            width, height = opened.size
            if width <= 0 or height <= 0 or width * height > settings.CASE_EVIDENCE_MAX_PIXELS:
                raise _invalid_image("The image dimensions exceed the safe evidence limit.")
            opened.verify()
        with Image.open(io.BytesIO(source)) as reopened:
            normalized_image = ImageOps.exif_transpose(reopened)
            mime_type, extension = ALLOWED_IMAGE_FORMATS[image_format]
            output = io.BytesIO()
            if image_format == "JPEG":
                normalized_image.convert("RGB").save(
                    output,
                    format="JPEG",
                    quality=88,
                    optimize=True,
                )
            elif image_format == "PNG":
                normalized_image.save(output, format="PNG", optimize=True)
            else:
                normalized_image.save(output, format="WEBP", quality=88, method=4)
            width, height = normalized_image.size
    except OpsPilotError:
        raise
    except (Image.DecompressionBombError, UnidentifiedImageError, OSError, ValueError) as exc:
        raise _invalid_image("The uploaded file is not a safe, readable evidence image.") from exc
    return output.getvalue(), mime_type, extension, width, height


def _invalid_image(message: str) -> OpsPilotError:
    return OpsPilotError(
        code="INVALID_EVIDENCE_IMAGE",
        message=message,
        status=422,
    )
