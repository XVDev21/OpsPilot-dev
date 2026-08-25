from dataclasses import replace
from datetime import timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest
import workos
from django.test import Client, override_settings
from django.utils import timezone

from accounts.models import AppUser
from cases.collaboration import (
    activate_collaboration,
    bind_authenticated_workspace,
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
from cases.models import (
    WorkOSEventReceipt,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
)
from cases.selectors import cases_for_user
from cases.services import create_case, publish_case
from cases.workos_directory import (
    DirectoryInvitation,
    DirectoryMembership,
    DirectoryOrganization,
    DirectoryUser,
    WorkOSDirectory,
    get_workos_directory,
)
from common.errors import OpsPilotError

pytestmark = pytest.mark.django_db


class FakeDirectory:
    def __init__(self, owner: AppUser):
        self.owner = owner
        self.organization_id = "org_test_opspilot"
        self.memberships: list[DirectoryMembership] = []
        self.invitations: list[DirectoryInvitation] = []
        self.users: dict[str, DirectoryUser] = {
            owner.workos_user_id: DirectoryUser(
                id=owner.workos_user_id,
                email=owner.email,
                name=owner.display_name or "",
            )
        }
        self.deactivated: list[str] = []
        self.fail_create: OpsPilotError | None = None
        self.fail_send: OpsPilotError | None = None

    def create_organization(self, *, name: str, external_id: str) -> DirectoryOrganization:
        if self.fail_create:
            raise self.fail_create
        assert external_id
        return DirectoryOrganization(id=self.organization_id, name=name)

    def create_membership(self, *, organization_id: str, user_id: str) -> DirectoryMembership:
        assert organization_id == self.organization_id
        existing = next((item for item in self.memberships if item.user_id == user_id), None)
        if existing:
            raise OpsPilotError(
                code="WORKOS_CONFLICT",
                message="conflict",
                status=409,
            )
        user = self.users[user_id]
        now = timezone.now()
        membership = DirectoryMembership(
            id=f"om_{len(self.memberships) + 1}",
            user_id=user_id,
            organization_id=organization_id,
            status="active",
            email=user.email,
            name=user.name,
            created_at=now,
            updated_at=now,
        )
        self.memberships.append(membership)
        return membership

    def send_invitation(
        self,
        *,
        organization_id: str,
        email: str,
        inviter_user_id: str,
        expires_in_days: int,
    ) -> DirectoryInvitation:
        if self.fail_send:
            raise self.fail_send
        assert organization_id == self.organization_id
        assert inviter_user_id == self.owner.workos_user_id
        now = timezone.now()
        invitation = DirectoryInvitation(
            id=f"inv_{len(self.invitations) + 1}",
            email=email,
            state="pending",
            organization_id=organization_id,
            accepted_user_id=None,
            accepted_at=None,
            revoked_at=None,
            expires_at=now + timedelta(days=expires_in_days),
            updated_at=now,
        )
        self.invitations.append(invitation)
        return invitation

    def revoke_invitation(self, invitation_id: str) -> DirectoryInvitation:
        current = next(item for item in self.invitations if item.id == invitation_id)
        updated = replace(
            current,
            state="revoked",
            revoked_at=timezone.now(),
            updated_at=timezone.now(),
        )
        self.invitations[self.invitations.index(current)] = updated
        return updated

    def list_invitations(self, *, organization_id: str) -> list[DirectoryInvitation]:
        assert organization_id == self.organization_id
        return self.invitations

    def list_memberships(self, *, organization_id: str) -> list[DirectoryMembership]:
        assert organization_id == self.organization_id
        return self.memberships

    def deactivate_membership(self, membership_id: str) -> DirectoryMembership:
        current = next(item for item in self.memberships if item.id == membership_id)
        updated = replace(
            current,
            status="inactive",
            updated_at=timezone.now(),
        )
        self.memberships[self.memberships.index(current)] = updated
        self.deactivated.append(membership_id)
        return updated

    def get_user(self, user_id: str) -> DirectoryUser:
        return self.users[user_id]


class FakeEvent:
    def __init__(self, event_id: str, event_type: str, data: dict):
        self.payload = {
            "id": event_id,
            "event": event_type,
            "data": data,
        }

    def to_dict(self) -> dict:
        return self.payload


@pytest.fixture
def owner() -> AppUser:
    return AppUser.objects.create(
        workos_user_id="user_collaboration_owner",
        email="owner@example.com",
        display_name="Case Owner",
    )


@pytest.fixture
def fake_directory(owner: AppUser, monkeypatch: pytest.MonkeyPatch) -> FakeDirectory:
    directory = FakeDirectory(owner)
    monkeypatch.setattr("cases.collaboration.get_workos_directory", lambda: directory)
    return directory


def _select(user: AppUser, organization_id: str = "org_test_opspilot") -> Workspace:
    return bind_authenticated_workspace(user, {"org_id": organization_id})


def test_collaboration_activation_invitation_replacement_and_member_lifecycle(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    workspace = activate_collaboration(user=owner, name="Operations Control")

    assert workspace.name == "Operations Control"
    assert workspace.workos_organization_id == fake_directory.organization_id
    assert workspace.collaboration_state == Workspace.CollaborationState.ACTIVE
    assert workspace.collaboration_enabled_at is not None
    owner_member = workspace.members.get(app_user=owner)
    assert owner_member.workos_membership_id == "om_1"
    assert workspace_context(owner)["items"][0]["isCurrent"] is True

    _select(owner)
    sample = workspace.members.get(key="sample-mina-park")
    invitation = invite_workspace_member(
        user=owner,
        email="ENGINEER@example.com",
        access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
        target_member_id=sample.id,
    )
    assert invitation.email == "engineer@example.com"
    assert invitation.target_member == sample
    assert invitation.workos_invitation_id == "inv_1"
    assert invitation.expires_at is not None
    assert list(workspace_invitations(owner)) == [invitation]

    with pytest.raises(OpsPilotError) as reserved:
        invite_workspace_member(
            user=owner,
            email="another-engineer@example.com",
            access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
            target_member_id=sample.id,
        )
    assert reserved.value.code == "SAMPLE_REPLACEMENT_RESERVED"

    with pytest.raises(OpsPilotError, match="pending invitation"):
        invite_workspace_member(
            user=owner,
            email="engineer@example.com",
            access_role=WorkspaceMember.AccessRole.VIEWER,
        )

    invitee = AppUser.objects.create(
        workos_user_id="user_invited_engineer",
        email="engineer@example.com",
        display_name="Real Engineer",
    )
    _select(invitee)
    sample.refresh_from_db()
    invitation.refresh_from_db()
    assert sample.app_user == invitee
    assert sample.is_sample is False
    assert sample.membership_state == WorkspaceMember.MembershipState.ACTIVE
    assert invitation.state == WorkspaceInvitation.State.ACCEPTED

    stale_invitation = WorkspaceInvitation.objects.create(
        workspace=workspace,
        email="second-engineer@example.com",
        access_role=WorkspaceMember.AccessRole.VIEWER,
        target_member=sample,
        invited_by=owner,
    )
    second_invitee = AppUser.objects.create(
        workos_user_id="user_second_invited_engineer",
        email="second-engineer@example.com",
        display_name="Second Engineer",
    )
    _select(second_invitee)
    sample.refresh_from_db()
    stale_invitation.refresh_from_db()
    second_member = workspace.members.get(app_user=second_invitee)
    assert sample.app_user == invitee
    assert second_member.id != sample.id
    assert second_member.access_role == WorkspaceMember.AccessRole.VIEWER
    assert stale_invitation.state == WorkspaceInvitation.State.ACCEPTED

    _select(owner)
    updated = update_workspace_member(
        user=owner,
        member_id=sample.id,
        access_role=WorkspaceMember.AccessRole.OPERATOR,
    )
    assert updated.access_role == WorkspaceMember.AccessRole.OPERATOR
    updated.workos_membership_id = "om_invitee"
    updated.save(update_fields=["workos_membership_id"])
    fake_directory.memberships.append(
        DirectoryMembership(
            id="om_invitee",
            user_id=invitee.workos_user_id,
            organization_id=fake_directory.organization_id,
            status="active",
            email=invitee.email,
            name=invitee.display_name or "",
            created_at=timezone.now(),
            updated_at=timezone.now(),
        )
    )
    removed = update_workspace_member(user=owner, member_id=sample.id, active=False)
    assert removed.membership_state == WorkspaceMember.MembershipState.INACTIVE
    assert fake_directory.deactivated == ["om_invitee"]

    with pytest.raises(OpsPilotError, match="owner cannot"):
        update_workspace_member(user=owner, member_id=owner_member.id, active=False)
    with pytest.raises(OpsPilotError, match="Invite this person again"):
        update_workspace_member(user=owner, member_id=sample.id, active=True)


def test_invitation_revoke_resend_reconcile_and_role_validation(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    activate_collaboration(user=owner)
    _select(owner)
    invitation = invite_workspace_member(
        user=owner,
        email="ops@example.com",
        access_role=WorkspaceMember.AccessRole.VIEWER,
    )
    revoked = revoke_workspace_invitation(user=owner, invitation_id=invitation.id)
    assert revoked.state == WorkspaceInvitation.State.REVOKED
    resent = resend_workspace_invitation(user=owner, invitation_id=invitation.id)
    assert resent.state == WorkspaceInvitation.State.PENDING
    assert resent.workos_invitation_id == "inv_2"

    result = reconcile_workspace(user=owner)
    assert result == {"memberCount": 1, "invitationCount": 2}
    assert workspace_members(owner).count() == 6

    with pytest.raises(OpsPilotError, match="operator, contributor, or viewer"):
        invite_workspace_member(
            user=owner,
            email="owner2@example.com",
            access_role=WorkspaceMember.AccessRole.OWNER,
        )
    with pytest.raises(OpsPilotError, match="sample profile"):
        invite_workspace_member(
            user=owner,
            email="bad-target@example.com",
            access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
            target_member_id=uuid4(),
        )

    with pytest.raises(OpsPilotError) as invalid_email:
        invite_workspace_member(
            user=owner,
            email="not-an-email",
            access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
        )
    assert invalid_email.value.code == "INVALID_INVITATION_EMAIL"


def test_revoking_an_invitation_releases_its_sample_reservation(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    workspace = activate_collaboration(user=owner)
    _select(owner)
    sample = workspace.members.get(key="sample-theo-bennett")
    first = invite_workspace_member(
        user=owner,
        email="first-replacement@example.com",
        access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
        target_member_id=sample.id,
    )

    revoke_workspace_invitation(user=owner, invitation_id=first.id)
    second = invite_workspace_member(
        user=owner,
        email="second-replacement@example.com",
        access_role=WorkspaceMember.AccessRole.OPERATOR,
        target_member_id=sample.id,
    )

    assert second.state == WorkspaceInvitation.State.PENDING
    assert second.target_member_id == sample.id
    with pytest.raises(OpsPilotError) as reserved:
        resend_workspace_invitation(user=owner, invitation_id=first.id)
    assert reserved.value.code == "SAMPLE_REPLACEMENT_RESERVED"


def test_failed_invitation_resend_records_recoverable_lifecycle_state(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    activate_collaboration(user=owner)
    _select(owner)
    invitation = invite_workspace_member(
        user=owner,
        email="retry@example.com",
        access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
    )
    fake_directory.fail_send = OpsPilotError(
        code="WORKOS_UNAVAILABLE",
        message="temporarily unavailable",
        status=503,
        retryable=True,
    )

    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        resend_workspace_invitation(user=owner, invitation_id=invitation.id)

    invitation.refresh_from_db()
    assert invitation.state == WorkspaceInvitation.State.FAILED
    assert invitation.failure_code == "WORKOS_UNAVAILABLE"
    assert fake_directory.invitations[0].state == "revoked"


def test_organization_context_enforces_draft_visibility_and_membership_roles(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    workspace = activate_collaboration(user=owner)
    draft = create_case(
        user=owner,
        title="Private investigation",
        description="This draft remains private until the owner publishes the reviewed case.",
    )
    invitation = invite_workspace_member(
        user=owner,
        email="viewer@example.com",
        access_role=WorkspaceMember.AccessRole.VIEWER,
    )
    viewer = AppUser.objects.create(
        workos_user_id="user_case_viewer",
        email="viewer@example.com",
        display_name="Case Viewer",
    )
    _select(viewer)
    assert invitation.id
    assert cases_for_user(viewer).count() == 0

    publish_case(user=owner, case_id=draft.id, override_advisory=True)
    assert list(cases_for_user(viewer).values_list("id", flat=True)) == [draft.id]

    viewer_member = workspace.members.get(app_user=viewer)
    with pytest.raises(OpsPilotError, match="workspace owner"):
        update_workspace_member(
            user=viewer,
            member_id=viewer_member.id,
            access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
        )
    with pytest.raises(OpsPilotError, match="not connected"):
        bind_authenticated_workspace(viewer, {"org_id": "org_unknown"})
    with pytest.raises(OpsPilotError, match="invalid organization"):
        bind_authenticated_workspace(viewer, {"org_id": "invalid"})

    bind_authenticated_workspace(owner, {})
    with pytest.raises(OpsPilotError, match="Select this workspace"):
        cases_for_user(owner).count()


def test_activation_failure_is_safe_and_retry_uses_existing_membership(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    fake_directory.fail_create = OpsPilotError(
        code="WORKOS_UNAVAILABLE",
        message="unavailable",
        status=503,
        retryable=True,
    )
    with pytest.raises(OpsPilotError, match="unavailable"):
        activate_collaboration(user=owner)
    workspace = owner.personal_workspace
    workspace.refresh_from_db()
    assert workspace.collaboration_state == Workspace.CollaborationState.ERROR
    assert workspace.collaboration_error_code == "WORKOS_UNAVAILABLE"

    fake_directory.fail_create = None
    workspace.workos_organization_id = fake_directory.organization_id
    workspace.save(update_fields=["workos_organization_id"])
    fake_directory.create_membership(
        organization_id=fake_directory.organization_id,
        user_id=owner.workos_user_id,
    )
    recovered = activate_collaboration(user=owner)
    assert recovered.collaboration_state == Workspace.CollaborationState.ACTIVE


def test_signed_webhook_processing_is_idempotent_and_preserves_stale_state(
    owner: AppUser,
    fake_directory: FakeDirectory,
) -> None:
    workspace = activate_collaboration(user=owner)
    _select(owner)
    invitation = invite_workspace_member(
        user=owner,
        email="webhook@example.com",
        access_role=WorkspaceMember.AccessRole.CONTRIBUTOR,
    )
    fake_directory.users["user_webhook"] = DirectoryUser(
        id="user_webhook",
        email="webhook@example.com",
        name="Webhook User",
    )
    now = timezone.now()
    accepted = FakeEvent(
        "event_invitation_accepted",
        "invitation.accepted",
        {
            "id": invitation.workos_invitation_id,
            "organization_id": workspace.workos_organization_id,
            "state": "accepted",
            "accepted_user_id": "user_webhook",
            "accepted_at": now.isoformat(),
            "updated_at": now.isoformat(),
        },
    )
    assert process_workos_event(accepted) is True
    assert process_workos_event(accepted) is False
    invitation.refresh_from_db()
    assert invitation.accepted_user.workos_user_id == "user_webhook"

    membership = FakeEvent(
        "event_membership_created",
        "organization_membership.created",
        {
            "id": "om_webhook",
            "organization_id": workspace.workos_organization_id,
            "user_id": "user_webhook",
            "status": "active",
            "created_at": now.isoformat(),
            "updated_at": (now + timedelta(minutes=1)).isoformat(),
        },
    )
    assert process_workos_event(membership) is True
    member = workspace.members.get(app_user__workos_user_id="user_webhook")
    assert member.workos_membership_id == "om_webhook"

    stale = FakeEvent(
        "event_membership_stale",
        "organization_membership.updated",
        {
            "id": "om_webhook",
            "organization_id": workspace.workos_organization_id,
            "user_id": "user_webhook",
            "status": "inactive",
            "created_at": now.isoformat(),
            "updated_at": (now - timedelta(minutes=1)).isoformat(),
        },
    )
    process_workos_event(stale)
    member.refresh_from_db()
    assert member.is_active is True

    deleted = FakeEvent(
        "event_membership_deleted",
        "organization_membership.deleted",
        {
            "id": "om_webhook",
            "organization_id": workspace.workos_organization_id,
            "user_id": "user_webhook",
            "status": "inactive",
            "created_at": now.isoformat(),
            "updated_at": (now + timedelta(minutes=2)).isoformat(),
        },
    )
    process_workos_event(deleted)
    member.refresh_from_db()
    assert member.membership_state == WorkspaceMember.MembershipState.INACTIVE
    assert WorkOSEventReceipt.objects.filter(processed_at__isnull=False).count() == 4

    with pytest.raises(OpsPilotError, match="incomplete"):
        process_workos_event(FakeEvent("", "", {}))


def test_webhook_endpoint_skips_bearer_auth(
    client: Client,
    owner: AppUser,
    fake_directory: FakeDirectory,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = activate_collaboration(user=owner)
    event = FakeEvent(
        "event_endpoint",
        "invitation.created",
        {
            "id": "inv_external",
            "organization_id": workspace.workos_organization_id,
            "updated_at": timezone.now().isoformat(),
        },
    )
    verifier = SimpleNamespace(verify_webhook=lambda **kwargs: event)
    monkeypatch.setattr("cases.api.get_workos_directory", lambda: verifier)

    response = client.post(
        "/api/v1/workos/events",
        data=b"{}",
        content_type="application/json",
        HTTP_WORKOS_SIGNATURE="signed",
    )

    assert response.status_code == 200
    assert response.json() == {"received": True, "processed": True}


def test_collaboration_api_contracts_and_organization_session(
    authenticated_client: Client,
    workos_claims: dict,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    assert authenticated_client.get("/api/v1/me").status_code == 200
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    directory = FakeDirectory(user)
    monkeypatch.setattr("cases.collaboration.get_workos_directory", lambda: directory)

    activated = authenticated_client.post(
        "/api/v1/workspace/collaboration",
        data={"name": "API Operations"},
        content_type="application/json",
    )
    assert activated.status_code == 200
    workspace_item = activated.json()["items"][0]
    assert workspace_item["workosOrganizationId"] == directory.organization_id

    blocked = authenticated_client.get("/api/v1/workspace/members")
    assert blocked.status_code == 409
    assert blocked.json()["error"]["code"] == "WORKSPACE_SELECTION_REQUIRED"

    workos_claims["org_id"] = directory.organization_id
    context = authenticated_client.get("/api/v1/workspace")
    assert context.status_code == 200
    members = authenticated_client.get("/api/v1/workspace/members")
    assert members.status_code == 200
    assert len(members.json()["items"]) == 6
    assert members.json()["items"][0]["membershipState"] in {"active", "sample"}

    invited = authenticated_client.post(
        "/api/v1/workspace/invitations",
        data={
            "email": "api-invite@example.com",
            "accessRole": "viewer",
        },
        content_type="application/json",
    )
    assert invited.status_code == 201
    invitation_id = invited.json()["id"]
    assert (
        authenticated_client.get("/api/v1/workspace/invitations").json()["items"][0]["state"]
        == "pending"
    )

    revoked = authenticated_client.post(f"/api/v1/workspace/invitations/{invitation_id}/revoke")
    assert revoked.json()["state"] == "revoked"
    resent = authenticated_client.post(f"/api/v1/workspace/invitations/{invitation_id}/resend")
    assert resent.json()["state"] == "pending"

    sample = next(item for item in members.json()["items"] if item["isSample"])
    patched = authenticated_client.patch(
        f"/api/v1/workspace/members/{sample['id']}",
        data={"accessRole": "viewer"},
        content_type="application/json",
    )
    assert patched.status_code == 200
    assert patched.json()["accessRole"] == "viewer"
    reconciled = authenticated_client.post("/api/v1/workspace/reconcile")
    assert reconciled.status_code == 200
    assert reconciled.json()["memberCount"] == 1


def test_workos_directory_adapter_normalizes_results_and_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = timezone.now()
    user = SimpleNamespace(
        id="user_sdk",
        email="SDK@EXAMPLE.COM",
        first_name="SDK",
        last_name="User",
    )
    role = SimpleNamespace(slug="member")
    membership = SimpleNamespace(
        id="om_sdk",
        user_id=user.id,
        organization_id="org_sdk",
        status=SimpleNamespace(value="active"),
        user=user,
        created_at=now,
        updated_at=now,
        role=role,
        roles=[role],
    )
    invitation = SimpleNamespace(
        id="inv_sdk",
        email="INVITE@EXAMPLE.COM",
        state=SimpleNamespace(value="pending"),
        organization_id="org_sdk",
        accepted_user_id=None,
        accepted_at=None,
        revoked_at=None,
        expires_at=now + timedelta(days=7),
        updated_at=now,
    )

    class Memberships:
        def create_organization_membership(self, **kwargs):
            return membership

        def list_organization_memberships(self, **kwargs):
            return [membership]

        def deactivate_organization_membership(self, membership_id):
            return membership

    class Invitations:
        def send_invitation(self, **kwargs):
            return invitation

        def list_invitations(self, **kwargs):
            return [invitation]

        def revoke_invitation(self, invitation_id):
            return invitation

        def get_user(self, user_id):
            return user

    client = SimpleNamespace(
        organizations=SimpleNamespace(
            create_organization=lambda **kwargs: SimpleNamespace(id="org_sdk", name=kwargs["name"])
        ),
        organization_membership=Memberships(),
        user_management=Invitations(),
        webhooks=SimpleNamespace(verify_event=lambda **kwargs: FakeEvent("event", "test", {})),
    )
    directory = WorkOSDirectory(client)
    assert directory.create_organization(name="SDK Org", external_id="local").id == "org_sdk"
    assert directory.create_membership(organization_id="org_sdk", user_id=user.id).email == (
        "sdk@example.com"
    )
    assert (
        directory.send_invitation(
            organization_id="org_sdk",
            email="invite@example.com",
            inviter_user_id=user.id,
            expires_in_days=7,
        ).email
        == "invite@example.com"
    )
    assert directory.list_memberships(organization_id="org_sdk")[0].name == "SDK User"
    assert directory.list_invitations(organization_id="org_sdk")[0].state == "pending"
    assert directory.deactivate_membership("om_sdk").id == "om_sdk"
    assert directory.revoke_invitation("inv_sdk").id == "inv_sdk"
    assert directory.get_user(user.id).name == "SDK User"

    with override_settings(WORKOS_WEBHOOK_SECRET="secret"):
        assert directory.verify_webhook(body=b"{}", signature="signed").payload["id"] == "event"
    with (
        override_settings(WORKOS_WEBHOOK_SECRET=""),
        pytest.raises(OpsPilotError, match="secret is not configured"),
    ):
        directory.verify_webhook(body=b"{}", signature="signed")

    for exception, expected_code in [
        (workos.RateLimitExceededError("limited"), "WORKOS_RATE_LIMITED"),
        (workos.AuthenticationError("bad key"), "COLLABORATION_CONFIGURATION_INVALID"),
        (workos.ConflictError("conflict"), "WORKOS_CONFLICT"),
        (workos.ServerError("down"), "WORKOS_UNAVAILABLE"),
    ]:

        def raise_exception(error=exception, **kwargs):
            raise error

        client.organizations.create_organization = raise_exception
        with pytest.raises(OpsPilotError) as captured:
            directory.create_organization(name="Fail", external_id="local")
        assert captured.value.code == expected_code

    client.webhooks.verify_event = lambda **kwargs: (_ for _ in ()).throw(ValueError("bad"))
    with (
        override_settings(WORKOS_WEBHOOK_SECRET="secret"),
        pytest.raises(OpsPilotError, match="signature is invalid"),
    ):
        directory.verify_webhook(body=b"{}", signature="bad")

    with (
        override_settings(WORKOS_API_KEY=""),
        pytest.raises(OpsPilotError, match="not configured"),
    ):
        get_workos_directory()

    def fail_workos(*args, **kwargs):
        raise workos.ServerError("down")

    client.organization_membership.create_organization_membership = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.create_membership(organization_id="org_sdk", user_id=user.id)
    client.organization_membership.list_organization_memberships = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.list_memberships(organization_id="org_sdk")
    client.organization_membership.deactivate_organization_membership = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.deactivate_membership("om_sdk")
    client.user_management.send_invitation = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.send_invitation(
            organization_id="org_sdk",
            email="fail@example.com",
            inviter_user_id=user.id,
            expires_in_days=7,
        )
    client.user_management.list_invitations = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.list_invitations(organization_id="org_sdk")
    client.user_management.revoke_invitation = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.revoke_invitation("inv_sdk")
    client.user_management.get_user = fail_workos
    with pytest.raises(OpsPilotError, match="temporarily unavailable"):
        directory.get_user(user.id)

    monkeypatch.setattr("cases.workos_directory.WorkOSClient", lambda **kwargs: client)
    with override_settings(WORKOS_API_KEY="sk_test", WORKOS_CLIENT_ID="client_test"):
        assert isinstance(get_workos_directory(), WorkOSDirectory)
