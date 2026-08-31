from datetime import timedelta
from io import StringIO
from types import SimpleNamespace
from uuid import uuid4

import pytest
from django.core.management import call_command
from django.test import Client, override_settings
from django.utils import timezone

from accounts.models import AppUser
from cases.delivery import create_case_update
from cases.models import (
    CaseAssignment,
    CaseDomainEvent,
    CaseUpdateMention,
    MemberNotificationPreference,
    Notification,
    NotificationDelivery,
    NotificationDeliveryAttempt,
    OperationsCase,
    ResendWebhookReceipt,
    WorkspaceMember,
    WorkspaceNotificationPolicy,
)
from cases.notifications import (
    dispatch_domain_event,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
    notification_preferences,
    opportunistic_dispatch,
    process_resend_webhook,
    safe_dispatch_domain_event,
    update_notification_preferences,
)
from cases.services import create_case, publish_case, update_case
from common.errors import OpsPilotError

pytestmark = pytest.mark.django_db


def _authenticate(client: Client) -> AppUser:
    response = client.get("/api/v1/me")
    assert response.status_code == 200
    return AppUser.objects.get(workos_user_id="user_test_primary")


def _real_member(
    owner: AppUser,
    *,
    key: str = "real-contributor",
    access_role: str = WorkspaceMember.AccessRole.CONTRIBUTOR,
) -> tuple[AppUser, WorkspaceMember]:
    user = AppUser.objects.create(
        workos_user_id=f"user_{key}",
        email=f"{key}@example.com",
        display_name="Real Contributor",
    )
    member = WorkspaceMember.objects.create(
        workspace=owner.personal_workspace,
        app_user=user,
        key=key,
        name="Real Contributor",
        email=user.email,
        initials="RC",
        role="Software engineer",
        discipline="Engineering",
        access_role=access_role,
    )
    user._opspilot_workspace_id = owner.personal_workspace.id
    return user, member


def _case(owner: AppUser) -> OperationsCase:
    case = create_case(
        user=owner,
        title="Notification delivery case",
        description="A sufficiently detailed case used to verify notification delivery behavior.",
    )
    publish_case(user=owner, case_id=case.id, override_advisory=True)
    return OperationsCase.objects.get(id=case.id)


def test_assignment_event_creates_one_inbox_item_and_email_delivery(
    authenticated_client: Client,
) -> None:
    owner = _authenticate(authenticated_client)
    _, recipient = _real_member(owner)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )

    assert dispatch_domain_event(event.id) == 1
    assert dispatch_domain_event(event.id) == 0

    notification = Notification.objects.get(event=event, recipient=recipient)
    assert notification.kind == Notification.Kind.ASSIGNMENT
    assert notification.action_path.startswith(f"/app/cases/{case.id}")
    delivery = notification.email_delivery
    assert delivery.status == NotificationDelivery.Status.PENDING
    assert delivery.recipient_email == recipient.email
    event.refresh_from_db()
    assert event.processed_at is not None


def test_recipient_safety_excludes_actor_samples_and_disabled_email(
    authenticated_client: Client,
) -> None:
    owner = _authenticate(authenticated_client)
    recipient_user, recipient = _real_member(owner)
    case = _case(owner)
    preference = MemberNotificationPreference.objects.get(member=recipient)
    preference.assignment_email = False
    preference.save(update_fields=["assignment_email"])
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    dispatch_domain_event(event.id)
    notification = Notification.objects.get(event=event)
    assert not hasattr(notification, "email_delivery")

    actor_event = CaseDomainEvent.objects.create(
        case=case,
        actor=recipient_user,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    assert dispatch_domain_event(actor_event.id) == 0
    sample = WorkspaceMember.objects.filter(workspace=case.workspace, is_sample=True).first()
    sample_event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(sample.id)},
    )
    assert dispatch_domain_event(sample_event.id) == 0


def test_preferences_support_inheritance_owner_defaults_and_member_opt_out(
    authenticated_client: Client,
) -> None:
    owner = _authenticate(authenticated_client)
    contributor_user, _ = _real_member(owner)
    initial = notification_preferences(user=owner)
    assert initial["emailEnabled"] is True
    assert initial["effectiveEvents"]["assignment"] is True
    assert initial["canManageWorkspaceDefaults"] is True

    changed = update_notification_preferences(
        user=owner,
        email_enabled=True,
        event_overrides={"blocker_email": False, "mention_email": None},
        workspace_defaults={"assignment_email": False},
    )
    assert changed["effectiveEvents"]["assignment"] is False
    assert changed["effectiveEvents"]["blocker"] is False

    contributor_changed = update_notification_preferences(
        user=contributor_user,
        email_enabled=False,
        event_overrides={},
    )
    assert contributor_changed["emailEnabled"] is False
    with pytest.raises(OpsPilotError, match="workspace owner"):
        update_notification_preferences(
            user=contributor_user,
            email_enabled=None,
            event_overrides={},
            workspace_defaults={"assignment_email": True},
        )


def test_notification_api_contract_and_read_state(authenticated_client: Client) -> None:
    owner = _authenticate(authenticated_client)
    response = authenticated_client.get("/api/v1/notification-preferences")
    assert response.status_code == 200
    assert response.json()["providerConfigured"] is False
    saved = authenticated_client.put(
        "/api/v1/notification-preferences",
        data={
            "emailEnabled": True,
            "eventOverrides": {
                "assignment": True,
                "blocker": True,
                "mention": True,
                "resolution": False,
                "verification": True,
                "dueDate": True,
            },
        },
        content_type="application/json",
    )
    assert saved.status_code == 200
    assert saved.json()["effectiveEvents"]["resolution"] is False

    recipient_user, recipient = _real_member(owner)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    dispatch_domain_event(event.id)
    inbox = list_notifications(user=recipient_user, unread_only=True, limit=10)
    assert inbox["unreadCount"] == 1
    notification_id = inbox["items"][0]["id"]
    read = mark_notification_read(user=recipient_user, notification_id=notification_id)
    assert read["readAt"] is not None
    assert mark_all_notifications_read(user=recipient_user) == 0
    with pytest.raises(OpsPilotError, match="not found"):
        mark_notification_read(user=recipient_user, notification_id=uuid4())


@override_settings(
    RESEND_API_KEY="re_test",
    FRONTEND_ORIGIN="https://opspilot.example",
    DEFAULT_FROM_EMAIL="OpsPilot <notifications@example.com>",
    NOTIFICATION_REPLY_TO_EMAIL="support@example.com",
)
def test_resend_send_retry_and_webhook_reconciliation(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = _authenticate(authenticated_client)
    _, recipient = _real_member(owner)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    dispatch_domain_event(event.id)
    captured: dict = {}

    def send(params, options):
        captured.update({"params": params, "options": options})
        return {"id": "email_test_123"}

    monkeypatch.setattr("cases.notifications.resend.Emails.send", send)
    assert opportunistic_dispatch(limit=1) == 1
    delivery = NotificationDelivery.objects.get()
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.SENT
    assert delivery.provider_message_id == "email_test_123"
    assert captured["options"]["idempotency_key"].startswith("notification-")
    assert "Notification delivery case" in captured["params"]["html"]
    assert NotificationDeliveryAttempt.objects.get().outcome == "sent"

    monkeypatch.setattr(
        "cases.notifications.resend.Webhooks.verify",
        lambda options: {"type": "email.delivered", "data": {"email_id": "email_test_123"}},
    )
    headers = {
        "svix-id": "webhook_test_1",
        "svix-timestamp": "1787700000",
        "svix-signature": "v1,test",
    }
    with override_settings(RESEND_WEBHOOK_SECRET="whsec_test"):
        assert process_resend_webhook(payload=b"{}", headers=headers) is True
        assert process_resend_webhook(payload=b"{}", headers=headers) is False
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.DELIVERED
    assert ResendWebhookReceipt.objects.count() == 1

    retry_event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.mentioned",
        payload={"memberIds": [str(recipient.id)]},
    )
    dispatch_domain_event(retry_event.id)
    monkeypatch.setattr(
        "cases.notifications.resend.Emails.send",
        lambda params, options: (_ for _ in ()).throw(OSError("temporary outage")),
    )
    assert opportunistic_dispatch(limit=1) == 1
    retry_delivery = NotificationDelivery.objects.get(notification__event=retry_event)
    assert retry_delivery.status == NotificationDelivery.Status.RETRY
    assert retry_delivery.attempts.get().outcome == "retry"


def test_structured_mentions_and_due_date_events(authenticated_client: Client) -> None:
    owner = _authenticate(authenticated_client)
    _, recipient = _real_member(owner)
    case = _case(owner)
    update = create_case_update(
        user=owner,
        case_id=case.id,
        update_type="progress",
        body="Please verify the implementation details before the next customer update.",
        client_request_id=uuid4(),
        mentioned_member_ids=[recipient.id],
    )
    mention_event = CaseDomainEvent.objects.get(case=case, event_type="case.mentioned")
    assert CaseUpdateMention.objects.filter(update=update, member=recipient).exists()
    assert dispatch_domain_event(mention_event.id) == 1

    update_case(
        user=owner, case_id=case.id, due_date=case.created_at.date(), due_date_supplied=True
    )
    due_event = CaseDomainEvent.objects.get(case=case, event_type="case.due-date.changed")
    assert due_event.payload["to"] == case.created_at.date().isoformat()


def test_unknown_event_and_invalid_webhook_are_safe(authenticated_client: Client) -> None:
    owner = _authenticate(authenticated_client)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(case=case, event_type="case.unknown")
    assert dispatch_domain_event(event.id) == 0
    event.refresh_from_db()
    assert event.processed_at is not None
    with pytest.raises(OpsPilotError, match="not configured"):
        process_resend_webhook(payload=b"{}", headers={})


def test_case_signal_recipient_matrix_and_copy(authenticated_client: Client) -> None:
    owner = _authenticate(authenticated_client)
    _, assignee = _real_member(owner, key="assignee")
    _, operator = _real_member(
        owner,
        key="operator",
        access_role=WorkspaceMember.AccessRole.OPERATOR,
    )
    case = _case(owner)
    CaseAssignment.objects.create(case=case, assignee=assignee, assigned_by=owner)

    expectations = [
        ("case.blocked", {}, {assignee.id, operator.id}, "needs attention"),
        ("case.resolution.proposed", {}, {assignee.id, operator.id}, "ready for review"),
        ("case.verification.passed", {}, {assignee.id}, "Verification passed"),
        ("case.verification.failed", {}, {assignee.id}, "Verification failed"),
        ("case.due-date.changed", {"to": None}, {assignee.id}, "Due date changed"),
        ("case.published", {}, {assignee.id}, "was published"),
    ]
    for event_type, payload, recipients, title_fragment in expectations:
        event = CaseDomainEvent.objects.create(
            case=case,
            actor=owner,
            event_type=event_type,
            payload=payload,
        )
        assert dispatch_domain_event(event.id) == len(recipients)
        notifications = Notification.objects.filter(event=event)
        assert set(notifications.values_list("recipient_id", flat=True)) == recipients
        assert title_fragment in notifications.first().title

    published = CaseDomainEvent.objects.create(case=case, event_type="case.published")
    assert dispatch_domain_event(published.id) == 2
    assert (
        Notification.objects.filter(event=published, summary__startswith="A teammate").count() == 2
    )


def test_email_policy_and_recipient_state_fail_closed(authenticated_client: Client) -> None:
    owner = _authenticate(authenticated_client)
    recipient_user, recipient = _real_member(owner)
    case = _case(owner)
    policy = WorkspaceNotificationPolicy.objects.get(workspace=case.workspace)
    policy.email_enabled = False
    policy.save(update_fields=["email_enabled"])
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    assert dispatch_domain_event(event.id) == 1
    assert not NotificationDelivery.objects.exists()

    policy.email_enabled = True
    policy.save(update_fields=["email_enabled"])
    recipient.email = None
    recipient.save(update_fields=["email"])
    recipient_user.email = ""
    recipient_user.save(update_fields=["email"])
    no_email_event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    assert dispatch_domain_event(no_email_event.id) == 1
    assert not NotificationDelivery.objects.exists()

    recipient.is_active = False
    recipient.save(update_fields=["is_active"])
    inactive_event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    assert dispatch_domain_event(inactive_event.id) == 0


def test_preference_noops_filters_and_bulk_read(authenticated_client: Client) -> None:
    owner = _authenticate(authenticated_client)
    recipient_user, recipient = _real_member(owner)
    unchanged = update_notification_preferences(
        user=owner,
        email_enabled=True,
        event_overrides={"not_a_preference": False},
        workspace_defaults={"not_a_default": False},
    )
    assert unchanged["emailEnabled"] is True

    case = _case(owner)
    for index in range(2):
        event = CaseDomainEvent.objects.create(
            case=case,
            actor=owner,
            event_type="case.assignment.changed",
            payload={"toMemberId": str(recipient.id), "sequence": index},
        )
        dispatch_domain_event(event.id)
    inbox = list_notifications(user=recipient_user, unread_only=False, limit=1)
    assert len(inbox["items"]) == 1
    assert inbox["unreadCount"] == 2
    assert mark_all_notifications_read(user=recipient_user) == 2
    first = Notification.objects.filter(recipient=recipient).first()
    already_read = mark_notification_read(user=recipient_user, notification_id=first.id)
    assert already_read["readAt"] is not None


@override_settings(
    RESEND_API_KEY="re_test",
    FRONTEND_ORIGIN="https://opspilot.example",
    DEFAULT_FROM_EMAIL="OpsPilot <notifications@example.com>",
    NOTIFICATION_REPLY_TO_EMAIL="",
)
def test_dispatch_reclaims_expired_lease_and_stops_at_empty_queue(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = _authenticate(authenticated_client)
    _, recipient = _real_member(owner)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    dispatch_domain_event(event.id)
    delivery = NotificationDelivery.objects.get()
    delivery.status = NotificationDelivery.Status.SENDING
    delivery.lease_expires_at = timezone.now() - timedelta(minutes=1)
    delivery.next_attempt_at = timezone.now() - timedelta(minutes=1)
    delivery.save(update_fields=["status", "lease_expires_at", "next_attempt_at"])
    monkeypatch.setattr(
        "cases.notifications.resend.Emails.send",
        lambda params, options: SimpleNamespace(id="email_object_response"),
    )

    assert opportunistic_dispatch(limit=2) == 1
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.SENT
    assert delivery.attempt_count == 1
    assert delivery.provider_message_id == "email_object_response"
    assert opportunistic_dispatch(limit=0) == 0


@override_settings(RESEND_API_KEY="re_test")
def test_delivery_reaches_terminal_failure_and_manual_command_reports_count(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = _authenticate(authenticated_client)
    _, recipient = _real_member(owner)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    dispatch_domain_event(event.id)
    delivery = NotificationDelivery.objects.get()
    delivery.attempt_count = 4
    delivery.save(update_fields=["attempt_count"])
    monkeypatch.setattr(
        "cases.notifications.resend.Emails.send",
        lambda params, options: (_ for _ in ()).throw(ValueError("invalid sender")),
    )
    stdout = StringIO()
    call_command("dispatch_notifications", limit=5_000, stdout=stdout)
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.FAILED
    assert delivery.attempts.get().outcome == "failed"
    assert "Processed 1 notification deliveries" in stdout.getvalue()


@override_settings(RESEND_WEBHOOK_SECRET="whsec_test")
def test_resend_webhook_failure_suppression_and_signature_errors(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner = _authenticate(authenticated_client)
    _, recipient = _real_member(owner)
    case = _case(owner)
    event = CaseDomainEvent.objects.create(
        case=case,
        actor=owner,
        event_type="case.assignment.changed",
        payload={"toMemberId": str(recipient.id)},
    )
    dispatch_domain_event(event.id)
    delivery = NotificationDelivery.objects.get()
    delivery.status = NotificationDelivery.Status.SENT
    delivery.provider_message_id = "email_status_test"
    delivery.save(update_fields=["status", "provider_message_id"])
    headers = {
        "svix-id": "webhook_status_1",
        "svix-timestamp": "1787700000",
        "svix-signature": "v1,test",
    }

    monkeypatch.setattr(
        "cases.notifications.resend.Webhooks.verify",
        lambda options: {"type": "email.bounced", "data": {"id": "email_status_test"}},
    )
    assert process_resend_webhook(payload=b"{}", headers=headers) is True
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.FAILED

    headers["svix-id"] = "webhook_status_2"
    monkeypatch.setattr(
        "cases.notifications.resend.Webhooks.verify",
        lambda options: {
            "type": "email.complained",
            "data": {"email_id": "email_status_test"},
        },
    )
    assert process_resend_webhook(payload=b"{}", headers=headers) is True
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.SUPPRESSED

    headers["svix-id"] = "webhook_status_3"
    monkeypatch.setattr(
        "cases.notifications.resend.Webhooks.verify",
        lambda options: {
            "type": "email.delivered",
            "data": {"email_id": "email_status_test"},
        },
    )
    assert process_resend_webhook(payload=b"{}", headers=headers) is True
    delivery.refresh_from_db()
    assert delivery.status == NotificationDelivery.Status.SUPPRESSED

    monkeypatch.setattr(
        "cases.notifications.resend.Webhooks.verify",
        lambda options: (_ for _ in ()).throw(ValueError("bad signature")),
    )
    with pytest.raises(OpsPilotError, match="could not be verified"):
        process_resend_webhook(payload=b"{}", headers={})
    with pytest.raises(OpsPilotError, match="could not be verified"):
        process_resend_webhook(payload=b"\xff", headers={})


def test_safe_dispatch_logs_unexpected_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "cases.notifications.dispatch_domain_event",
        lambda event_id: (_ for _ in ()).throw(RuntimeError("database unavailable")),
    )
    safe_dispatch_domain_event(uuid4())
