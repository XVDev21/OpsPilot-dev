import html
import logging
from datetime import timedelta
from typing import Any
from uuid import UUID

import resend
from django.conf import settings
from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone
from resend.exceptions import ResendError

from accounts.models import AppUser
from cases.models import (
    CaseDomainEvent,
    MemberNotificationPreference,
    Notification,
    NotificationDelivery,
    NotificationDeliveryAttempt,
    ResendWebhookReceipt,
    WorkspaceMember,
    WorkspaceNotificationPolicy,
)
from cases.selectors import selected_workspace_for_user
from common.errors import OpsPilotError

logger = logging.getLogger(__name__)

EVENT_POLICY_FIELDS = {
    "case.assignment.changed": (Notification.Kind.ASSIGNMENT, "assignment_email"),
    "case.blocked": (Notification.Kind.BLOCKER, "blocker_email"),
    "case.mentioned": (Notification.Kind.MENTION, "mention_email"),
    "case.resolution.proposed": (Notification.Kind.RESOLUTION, "resolution_email"),
    "case.verification.passed": (Notification.Kind.VERIFICATION, "verification_email"),
    "case.verification.failed": (Notification.Kind.VERIFICATION, "verification_email"),
    "case.due-date.changed": (Notification.Kind.DUE_DATE, "due_date_email"),
    "case.published": (Notification.Kind.PUBLISHED, None),
}
RETRY_DELAYS = (60, 300, 1_800, 7_200, 36_000)
TERMINAL_DELIVERY_STATUSES = {
    NotificationDelivery.Status.DELIVERED,
    NotificationDelivery.Status.FAILED,
    NotificationDelivery.Status.SUPPRESSED,
}


def ensure_notification_defaults(*, member: WorkspaceMember) -> None:
    WorkspaceNotificationPolicy.objects.get_or_create(workspace=member.workspace)
    if member.app_user_id and not member.is_sample:
        MemberNotificationPreference.objects.get_or_create(member=member)


def notification_preferences(*, user: AppUser) -> dict[str, Any]:
    workspace, member = selected_workspace_for_user(user)
    policy, _ = WorkspaceNotificationPolicy.objects.get_or_create(workspace=workspace)
    preference, _ = MemberNotificationPreference.objects.get_or_create(member=member)
    can_manage = member.access_role == WorkspaceMember.AccessRole.OWNER
    return _preference_payload(
        policy=policy,
        preference=preference,
        can_manage_workspace=can_manage,
    )


@transaction.atomic
def update_notification_preferences(
    *,
    user: AppUser,
    email_enabled: bool | None,
    event_overrides: dict[str, bool | None],
    workspace_defaults: dict[str, bool] | None = None,
) -> dict[str, Any]:
    workspace, member = selected_workspace_for_user(user)
    policy, _ = WorkspaceNotificationPolicy.objects.select_for_update().get_or_create(
        workspace=workspace
    )
    preference, _ = MemberNotificationPreference.objects.select_for_update().get_or_create(
        member=member
    )
    preference_fields: list[str] = []
    if email_enabled is not None and email_enabled != preference.email_enabled:
        preference.email_enabled = email_enabled
        preference_fields.append("email_enabled")
    for field, value in event_overrides.items():
        if field not in _preference_field_names():
            continue
        if getattr(preference, field) != value:
            setattr(preference, field, value)
            preference_fields.append(field)
    if preference_fields:
        preference.save(update_fields=[*preference_fields, "updated_at"])

    if workspace_defaults is not None:
        if member.access_role != WorkspaceMember.AccessRole.OWNER:
            raise OpsPilotError(
                code="WORKSPACE_OWNER_REQUIRED",
                message="Only the workspace owner can change notification defaults.",
                status=403,
            )
        policy_fields: list[str] = []
        for field, value in workspace_defaults.items():
            if field not in {"email_enabled", *_preference_field_names()}:
                continue
            if getattr(policy, field) != value:
                setattr(policy, field, value)
                policy_fields.append(field)
        if policy_fields:
            policy.save(update_fields=[*policy_fields, "updated_at"])
    return _preference_payload(
        policy=policy,
        preference=preference,
        can_manage_workspace=member.access_role == WorkspaceMember.AccessRole.OWNER,
    )


def _preference_field_names() -> tuple[str, ...]:
    return (
        "assignment_email",
        "blocker_email",
        "mention_email",
        "resolution_email",
        "verification_email",
        "due_date_email",
    )


def _preference_payload(
    *,
    policy: WorkspaceNotificationPolicy,
    preference: MemberNotificationPreference,
    can_manage_workspace: bool,
) -> dict[str, Any]:
    personal = {field: getattr(preference, field) for field in _preference_field_names()}
    workspace = {
        "email_enabled": policy.email_enabled,
        **{field: getattr(policy, field) for field in _preference_field_names()},
    }
    effective = {
        field: (
            preference.email_enabled
            and policy.email_enabled
            and (personal[field] if personal[field] is not None else workspace[field])
        )
        for field in _preference_field_names()
    }
    return {
        "emailEnabled": preference.email_enabled,
        "eventOverrides": _camel_event_values(personal),
        "effectiveEvents": _camel_event_values(effective),
        "workspaceDefaults": {
            "emailEnabled": workspace["email_enabled"],
            **_camel_event_values({field: workspace[field] for field in _preference_field_names()}),
        },
        "canManageWorkspaceDefaults": can_manage_workspace,
        "providerConfigured": bool(settings.RESEND_API_KEY),
        "sender": settings.DEFAULT_FROM_EMAIL,
    }


def _camel_event_values(values: dict[str, bool | None]) -> dict[str, bool | None]:
    return {
        "assignment": values["assignment_email"],
        "blocker": values["blocker_email"],
        "mention": values["mention_email"],
        "resolution": values["resolution_email"],
        "verification": values["verification_email"],
        "dueDate": values["due_date_email"],
    }


def list_notifications(*, user: AppUser, unread_only: bool, limit: int) -> dict[str, Any]:
    _, member = selected_workspace_for_user(user)
    opportunistic_dispatch(limit=settings.NOTIFICATION_OPPORTUNISTIC_LIMIT)
    records = Notification.objects.filter(recipient=member).select_related("case")
    if unread_only:
        records = records.filter(read_at__isnull=True)
    items = list(records[:limit])
    unread_count = Notification.objects.filter(recipient=member, read_at__isnull=True).count()
    return {"items": [_notification_payload(item) for item in items], "unreadCount": unread_count}


@transaction.atomic
def mark_notification_read(*, user: AppUser, notification_id: UUID) -> dict[str, Any]:
    _, member = selected_workspace_for_user(user)
    notification = (
        Notification.objects.select_for_update()
        .select_related("case")
        .filter(id=notification_id, recipient=member)
        .first()
    )
    if notification is None:
        raise OpsPilotError(
            code="NOT_FOUND", message="That notification was not found.", status=404
        )
    if notification.read_at is None:
        notification.read_at = timezone.now()
        notification.save(update_fields=["read_at"])
    return _notification_payload(notification)


def mark_all_notifications_read(*, user: AppUser) -> int:
    _, member = selected_workspace_for_user(user)
    return Notification.objects.filter(recipient=member, read_at__isnull=True).update(
        read_at=timezone.now()
    )


def _notification_payload(notification: Notification) -> dict[str, Any]:
    return {
        "id": notification.id,
        "kind": notification.kind,
        "title": notification.title,
        "summary": notification.summary,
        "caseId": notification.case_id,
        "caseKey": notification.case.key,
        "caseTitle": notification.case.title,
        "actionPath": notification.action_path,
        "readAt": notification.read_at,
        "createdAt": notification.created_at,
    }


@transaction.atomic
def dispatch_domain_event(event_id: UUID) -> int:
    event = (
        CaseDomainEvent.objects.select_for_update()
        .select_related("case__workspace", "case__created_by", "actor")
        .filter(id=event_id)
        .first()
    )
    if event is None or event.processed_at is not None:
        return 0
    spec = EVENT_POLICY_FIELDS.get(event.event_type)
    if spec is None:
        event.processed_at = timezone.now()
        event.save(update_fields=["processed_at"])
        return 0
    kind, preference_field = spec
    recipients = _eligible_recipients(event)
    title, summary = _notification_copy(event, kind)
    created = 0
    for recipient in recipients:
        notification, was_created = Notification.objects.get_or_create(
            event=event,
            recipient=recipient,
            defaults={
                "workspace": event.case.workspace,
                "case": event.case,
                "kind": kind,
                "title": title,
                "summary": summary,
                "action_path": f"/app/cases/{event.case_id}?source=notification",
            },
        )
        if not was_created:
            continue
        created += 1
        if preference_field and _email_allowed(recipient, preference_field):
            email = recipient.email or (recipient.app_user.email if recipient.app_user else None)
            if email:
                NotificationDelivery.objects.get_or_create(
                    notification=notification,
                    defaults={
                        "recipient_email": email,
                        "idempotency_key": f"notification-{notification.id}",
                        "next_attempt_at": timezone.now(),
                    },
                )
    event.processed_at = timezone.now()
    event.save(update_fields=["processed_at"])
    return created


def _eligible_recipients(event: CaseDomainEvent) -> list[WorkspaceMember]:
    case = event.case
    member_ids: set[str] = set()
    assignment = getattr(case, "assignment", None)
    assignee_id = str(assignment.assignee_id) if assignment and assignment.assignee_id else None
    creator_member = WorkspaceMember.objects.filter(
        workspace=case.workspace, app_user=case.created_by
    ).first()
    if event.event_type == "case.assignment.changed":
        if event.payload.get("toMemberId"):
            member_ids.add(str(event.payload["toMemberId"]))
    elif event.event_type == "case.mentioned":
        member_ids.update(str(value) for value in event.payload.get("memberIds", []))
    elif event.event_type in {"case.blocked", "case.resolution.proposed"}:
        if assignee_id:
            member_ids.add(assignee_id)
        if creator_member:
            member_ids.add(str(creator_member.id))
        member_ids.update(
            str(value)
            for value in WorkspaceMember.objects.filter(
                workspace=case.workspace,
                access_role__in=[
                    WorkspaceMember.AccessRole.OWNER,
                    WorkspaceMember.AccessRole.OPERATOR,
                ],
            ).values_list("id", flat=True)
        )
    elif event.event_type.startswith("case.verification."):
        if assignee_id:
            member_ids.add(assignee_id)
        if creator_member:
            member_ids.add(str(creator_member.id))
    elif event.event_type == "case.due-date.changed":
        if assignee_id:
            member_ids.add(assignee_id)
    elif event.event_type == "case.published":
        if assignee_id:
            member_ids.add(assignee_id)
        if creator_member:
            member_ids.add(str(creator_member.id))
    queryset = WorkspaceMember.objects.filter(
        id__in=member_ids,
        workspace=case.workspace,
        app_user__isnull=False,
        is_sample=False,
        is_active=True,
        membership_state=WorkspaceMember.MembershipState.ACTIVE,
    ).select_related("app_user", "workspace")
    if event.actor_id:
        queryset = queryset.exclude(app_user_id=event.actor_id)
    return list(queryset)


def _notification_copy(event: CaseDomainEvent, kind: str) -> tuple[str, str]:
    actor = event.actor.display_name if event.actor and event.actor.display_name else "A teammate"
    case_key = event.case.key
    if kind == Notification.Kind.ASSIGNMENT:
        return f"Assigned to {case_key}", f"{actor} assigned this case to you."
    if kind == Notification.Kind.BLOCKER:
        return f"{case_key} needs attention", f"{actor} recorded a blocker."
    if kind == Notification.Kind.MENTION:
        return f"Mentioned in {case_key}", f"{actor} mentioned you in a case update."
    if kind == Notification.Kind.RESOLUTION:
        return f"{case_key} is ready for review", f"{actor} proposed a resolution."
    if kind == Notification.Kind.VERIFICATION:
        result = "passed" if event.event_type.endswith("passed") else "failed"
        return f"Verification {result} for {case_key}", f"{actor} recorded the verification result."
    if kind == Notification.Kind.DUE_DATE:
        value = event.payload.get("to") or "No due date"
        return f"Due date changed for {case_key}", f"{actor} changed the target date to {value}."
    return f"{case_key} was published", f"{actor} published the case."


def _email_allowed(member: WorkspaceMember, preference_field: str) -> bool:
    policy, _ = WorkspaceNotificationPolicy.objects.get_or_create(workspace=member.workspace)
    preference, _ = MemberNotificationPreference.objects.get_or_create(member=member)
    override = getattr(preference, preference_field)
    return bool(
        policy.email_enabled
        and preference.email_enabled
        and (override if override is not None else getattr(policy, preference_field))
    )


def opportunistic_dispatch(*, limit: int) -> int:
    if not settings.RESEND_API_KEY or limit <= 0:
        return 0
    sent = 0
    for _ in range(limit):
        delivery = _claim_delivery()
        if delivery is None:
            break
        _send_delivery(delivery.id)
        sent += 1
    return sent


@transaction.atomic
def _claim_delivery() -> NotificationDelivery | None:
    now = timezone.now()
    candidates = NotificationDelivery.objects.filter(
        Q(status__in=[NotificationDelivery.Status.PENDING, NotificationDelivery.Status.RETRY])
        | Q(status=NotificationDelivery.Status.SENDING, lease_expires_at__lt=now),
        next_attempt_at__lte=now,
    ).select_related("notification__case", "notification__recipient__app_user")
    if connection.features.has_select_for_update_skip_locked:
        candidates = candidates.select_for_update(skip_locked=True)
    else:
        candidates = candidates.select_for_update()
    delivery = candidates.order_by("next_attempt_at", "created_at").first()
    if delivery is None:
        return None
    delivery.status = NotificationDelivery.Status.SENDING
    delivery.attempt_count += 1
    delivery.lease_expires_at = now + timedelta(minutes=5)
    delivery.save(update_fields=["status", "attempt_count", "lease_expires_at", "updated_at"])
    return delivery


def _send_delivery(delivery_id: UUID) -> None:
    delivery = NotificationDelivery.objects.select_related(
        "notification__case", "notification__recipient"
    ).get(id=delivery_id)
    notification = delivery.notification
    case_url = f"{settings.FRONTEND_ORIGIN}{notification.action_path}"
    params: resend.Emails.SendParams = {
        "from": settings.DEFAULT_FROM_EMAIL,
        "to": [delivery.recipient_email],
        "subject": notification.title,
        "text": f"{notification.summary}\n\nOpen {notification.case.key}: {case_url}",
        "html": _email_html(notification=notification, case_url=case_url),
    }
    if settings.NOTIFICATION_REPLY_TO_EMAIL:
        params["reply_to"] = [settings.NOTIFICATION_REPLY_TO_EMAIL]
    resend.api_key = settings.RESEND_API_KEY
    try:
        response = resend.Emails.send(params, {"idempotency_key": delivery.idempotency_key})
        provider_message_id = response.get("id", "") if isinstance(response, dict) else response.id
    except (ResendError, OSError, ValueError) as error:
        _record_delivery_failure(delivery_id=delivery.id, error=error)
        return
    now = timezone.now()
    NotificationDelivery.objects.filter(id=delivery.id).update(
        status=NotificationDelivery.Status.SENT,
        provider_message_id=provider_message_id,
        sent_at=now,
        lease_expires_at=None,
        last_error_code="",
        last_error_message="",
        updated_at=now,
    )
    NotificationDeliveryAttempt.objects.create(
        delivery_id=delivery.id,
        attempt_number=delivery.attempt_count,
        outcome="sent",
        provider_message_id=provider_message_id,
    )


def _email_html(*, notification: Notification, case_url: str) -> str:
    title = html.escape(notification.title)
    summary = html.escape(notification.summary)
    case_title = html.escape(notification.case.title)
    url = html.escape(case_url, quote=True)
    return (
        '<div style="background:#f6f8fc;padding:32px 16px;font-family:Arial,sans-serif;'
        'color:#172033">'
        '<div style="max-width:560px;margin:auto;background:#fff;border:1px solid #d8e1ec;'
        'border-radius:16px;padding:28px">'
        '<p style="margin:0 0 10px;color:#4f46e5;font-size:12px;font-weight:700;'
        'letter-spacing:.08em;text-transform:uppercase">OpsPilot case signal</p>'
        f'<h1 style="margin:0;font-size:22px;line-height:1.3">{title}</h1>'
        f'<p style="margin:16px 0 6px;line-height:1.6">{summary}</p>'
        f'<p style="margin:0 0 22px;color:#5c697d;line-height:1.6">{case_title}</p>'
        f'<a href="{url}" style="display:inline-block;background:#4f46e5;color:#fff;'
        'padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:700">Open case</a>'
        '<p style="margin:24px 0 0;color:#7c899d;font-size:12px;line-height:1.5">'
        "Change email notification preferences in OpsPilot Settings.</p></div></div>"
    )


@transaction.atomic
def _record_delivery_failure(*, delivery_id: UUID, error: Exception) -> None:
    delivery = NotificationDelivery.objects.select_for_update().get(id=delivery_id)
    retry = delivery.attempt_count < len(RETRY_DELAYS)
    delivery.status = (
        NotificationDelivery.Status.RETRY if retry else NotificationDelivery.Status.FAILED
    )
    delivery.next_attempt_at = timezone.now() + timedelta(
        seconds=RETRY_DELAYS[min(delivery.attempt_count - 1, len(RETRY_DELAYS) - 1)]
    )
    delivery.lease_expires_at = None
    delivery.last_error_code = type(error).__name__[:80]
    delivery.last_error_message = str(error)[:500]
    delivery.save(
        update_fields=[
            "status",
            "next_attempt_at",
            "lease_expires_at",
            "last_error_code",
            "last_error_message",
            "updated_at",
        ]
    )
    NotificationDeliveryAttempt.objects.create(
        delivery=delivery,
        attempt_number=delivery.attempt_count,
        outcome="retry" if retry else "failed",
        error_code=delivery.last_error_code,
        error_message=delivery.last_error_message,
    )
    logger.warning("Notification delivery %s failed: %s", delivery.id, error)


@transaction.atomic
def process_resend_webhook(*, payload: bytes, headers: dict[str, str]) -> bool:
    if not settings.RESEND_WEBHOOK_SECRET:
        raise OpsPilotError(
            code="RESEND_WEBHOOK_UNAVAILABLE",
            message="Resend webhook verification is not configured.",
            status=503,
        )
    try:
        event = resend.Webhooks.verify(
            {
                "payload": payload.decode("utf-8"),
                "headers": {
                    "id": headers.get("svix-id", ""),
                    "timestamp": headers.get("svix-timestamp", ""),
                    "signature": headers.get("svix-signature", ""),
                },
                "webhook_secret": settings.RESEND_WEBHOOK_SECRET,
            }
        )
    except (UnicodeDecodeError, ValueError) as error:
        raise OpsPilotError(
            code="INVALID_RESEND_SIGNATURE",
            message="The Resend event signature could not be verified.",
            status=401,
        ) from error
    event_id = headers.get("svix-id", "")
    event_type = str(event.get("type", ""))
    data = event.get("data") or {}
    message_id = str(data.get("email_id") or data.get("id") or "")
    receipt, created = ResendWebhookReceipt.objects.get_or_create(
        event_id=event_id,
        defaults={"event_type": event_type, "provider_message_id": message_id},
    )
    if not created:
        return False
    delivery = (
        NotificationDelivery.objects.select_for_update()
        .filter(provider_message_id=message_id)
        .first()
    )
    if delivery is not None:
        now = timezone.now()
        if event_type == "email.delivered" and delivery.status not in {
            NotificationDelivery.Status.FAILED,
            NotificationDelivery.Status.SUPPRESSED,
        }:
            delivery.status = NotificationDelivery.Status.DELIVERED
            delivery.delivered_at = now
        elif event_type in {"email.complained", "email.suppressed"}:
            delivery.status = NotificationDelivery.Status.SUPPRESSED
        elif event_type in {"email.bounced", "email.failed"} and delivery.status != (
            NotificationDelivery.Status.SUPPRESSED
        ):
            delivery.status = NotificationDelivery.Status.FAILED
        delivery.save(update_fields=["status", "delivered_at", "updated_at"])
    receipt.processed_at = timezone.now()
    receipt.save(update_fields=["processed_at"])
    return True


def safe_dispatch_domain_event(event_id: UUID) -> None:
    try:
        dispatch_domain_event(event_id)
        opportunistic_dispatch(limit=1)
    except Exception:
        logger.exception("Could not dispatch case domain event %s", event_id)
