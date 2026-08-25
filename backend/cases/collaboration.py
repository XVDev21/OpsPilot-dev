import logging
from datetime import datetime
from uuid import UUID

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from accounts.models import AppUser
from cases.models import (
    OperationsCase,
    WorkOSEventReceipt,
    Workspace,
    WorkspaceInvitation,
    WorkspaceMember,
)
from cases.workos_directory import (
    DirectoryInvitation,
    DirectoryMembership,
    DirectoryUser,
    get_workos_directory,
)
from common.errors import OpsPilotError

logger = logging.getLogger(__name__)

MANAGED_INVITE_ROLES = {
    WorkspaceMember.AccessRole.OPERATOR,
    WorkspaceMember.AccessRole.CONTRIBUTOR,
    WorkspaceMember.AccessRole.VIEWER,
}


def _initials(name: str, email: str | None = None) -> str:
    source = name or (email or "Team member").split("@")[0]
    value = "".join(part[0] for part in source.split()[:2]).upper()
    return (value or "TM")[:4]


def _member_key(workspace: Workspace, user_id: str) -> str:
    base = f"member-{user_id}"[:64]
    if not WorkspaceMember.objects.filter(workspace=workspace, key=base).exists():
        return base
    return f"member-{user_id[-24:]}-{WorkspaceMember.objects.filter(workspace=workspace).count()}"[
        :64
    ]


def _selected_workspace(user: AppUser, *, allow_unselected: bool = False) -> Workspace:
    selected_id = getattr(user, "_opspilot_workspace_id", None)
    if selected_id is not None:
        workspace = Workspace.objects.filter(
            id=selected_id,
            members__app_user=user,
            members__is_active=True,
        ).first()
    else:
        workspace = Workspace.objects.filter(owner=user).first()
    if workspace is None:
        raise OpsPilotError(
            code="WORKSPACE_ACCESS_DENIED",
            message="Your account is not an active member of this workspace.",
            status=403,
        )
    if (
        not allow_unselected
        and getattr(user, "_opspilot_auth_context", False)
        and not getattr(user, "_opspilot_organization_id", None)
        and workspace.collaboration_state == Workspace.CollaborationState.ACTIVE
    ):
        raise OpsPilotError(
            code="WORKSPACE_SELECTION_REQUIRED",
            message="Select this workspace again to refresh its organization session.",
            status=409,
        )
    return workspace


def _acting_member(user: AppUser, workspace: Workspace) -> WorkspaceMember:
    member = WorkspaceMember.objects.filter(
        workspace=workspace,
        app_user=user,
        is_active=True,
    ).first()
    if member is None:
        raise OpsPilotError(
            code="WORKSPACE_ACCESS_DENIED",
            message="Your account is not an active member of this workspace.",
            status=403,
        )
    return member


def _require_owner(user: AppUser, workspace: Workspace) -> WorkspaceMember:
    member = _acting_member(user, workspace)
    if member.access_role != WorkspaceMember.AccessRole.OWNER:
        raise OpsPilotError(
            code="WORKSPACE_OWNER_REQUIRED",
            message="Only the workspace owner can manage membership.",
            status=403,
        )
    return member


def bind_authenticated_workspace(user: AppUser, claims: dict) -> Workspace:
    """Bind a WorkOS organization claim to a local workspace for this request only."""
    organization_id = claims.get("org_id")
    if organization_id is not None and (
        not isinstance(organization_id, str) or not organization_id.startswith("org_")
    ):
        raise OpsPilotError(
            code="INVALID_ORGANIZATION_CONTEXT",
            message="The session contains an invalid organization context.",
            status=401,
        )

    if organization_id:
        workspace = Workspace.objects.filter(workos_organization_id=organization_id).first()
        if workspace is None:
            raise OpsPilotError(
                code="WORKSPACE_ACCESS_DENIED",
                message="This WorkOS organization is not connected to an OpsPilot workspace.",
                status=403,
            )
        member = WorkspaceMember.objects.filter(workspace=workspace, app_user=user).first()
        if member is None:
            member = _link_user_from_invitation(
                workspace=workspace,
                user=user,
                email=(user.email or "").strip().lower() or None,
                name=user.display_name or "",
            )
        if (
            not member.is_active
            or member.membership_state == WorkspaceMember.MembershipState.INACTIVE
        ):
            raise OpsPilotError(
                code="WORKSPACE_ACCESS_DENIED",
                message="Your workspace membership is inactive.",
                status=403,
            )
    else:
        workspace = Workspace.objects.filter(owner=user).first()
        if workspace is None:
            from cases.services import ensure_personal_workspace

            workspace = ensure_personal_workspace(user)

    user._opspilot_auth_context = True
    user._opspilot_organization_id = organization_id
    user._opspilot_workspace_id = workspace.id
    return workspace


@transaction.atomic
def _link_user_from_invitation(
    *,
    workspace: Workspace,
    user: AppUser,
    email: str | None,
    name: str,
    membership_id: str | None = None,
    external_updated_at: datetime | None = None,
) -> WorkspaceMember:
    invitation = None
    if email:
        invitation = (
            WorkspaceInvitation.objects.select_for_update()
            .filter(
                workspace=workspace,
                email=email,
            )
            .filter(
                Q(state=WorkspaceInvitation.State.PENDING)
                | Q(
                    state=WorkspaceInvitation.State.ACCEPTED,
                    accepted_user__isnull=True,
                )
                | Q(
                    state=WorkspaceInvitation.State.ACCEPTED,
                    accepted_user=user,
                )
            )
            .order_by("-created_at")
            .first()
        )
    existing = (
        WorkspaceMember.objects.select_for_update()
        .filter(
            workspace=workspace,
            app_user=user,
        )
        .first()
    )
    target = None
    if invitation and invitation.target_member_id and existing is None:
        target = (
            WorkspaceMember.objects.select_for_update()
            .filter(
                id=invitation.target_member_id,
                workspace=workspace,
                is_sample=True,
                app_user__isnull=True,
                is_active=True,
            )
            .first()
        )
    member = existing or target
    if member is None:
        member = WorkspaceMember(
            workspace=workspace,
            key=_member_key(workspace, user.workos_user_id),
            role="Workspace member",
            discipline="Operations",
            focus="Collaborates on published operations cases.",
            availability="Available",
            workflow_fit=["Case collaboration"],
            tone=WorkspaceMember.Tone.NEUTRAL,
        )
    member.app_user = user
    member.name = (name or user.display_name or email or "Workspace member")[:120]
    member.email = email or user.email
    member.initials = _initials(member.name, member.email)
    member.access_role = invitation.access_role if invitation else WorkspaceMember.AccessRole.VIEWER
    member.is_sample = False
    member.is_active = True
    member.membership_state = WorkspaceMember.MembershipState.ACTIVE
    member.workos_membership_id = membership_id or member.workos_membership_id
    member.external_updated_at = external_updated_at or member.external_updated_at
    member.joined_at = member.joined_at or timezone.now()
    member.deactivated_at = None
    member.save()
    if invitation:
        invitation.accepted_user = user
        invitation.state = WorkspaceInvitation.State.ACCEPTED
        invitation.accepted_at = invitation.accepted_at or timezone.now()
        invitation.save(update_fields=["accepted_user", "state", "accepted_at", "updated_at"])
    return member


def workspace_context(user: AppUser) -> dict:
    current = _selected_workspace(user, allow_unselected=True)
    memberships = (
        WorkspaceMember.objects.filter(app_user=user, is_active=True)
        .select_related("workspace")
        .order_by("workspace__created_at", "workspace__name")
    )
    return {
        "currentWorkspaceId": current.id,
        "items": [
            {
                "id": member.workspace.id,
                "name": member.workspace.name,
                "workosOrganizationId": member.workspace.workos_organization_id,
                "collaborationState": member.workspace.collaboration_state,
                "accessRole": member.access_role,
                "isCurrent": member.workspace_id == current.id,
            }
            for member in memberships
        ],
    }


def workspace_members(user: AppUser):
    workspace = _selected_workspace(user)
    _acting_member(user, workspace)
    return (
        WorkspaceMember.objects.filter(workspace=workspace)
        .annotate(
            assigned_case_count=Count(
                "case_assignments",
                filter=~Q(
                    case_assignments__case__status__in=[
                        OperationsCase.Status.RESOLVED,
                        OperationsCase.Status.CLOSED,
                    ]
                ),
                distinct=True,
            ),
            open_task_count=Count(
                "work_items",
                filter=~Q(work_items__status="done"),
                distinct=True,
            ),
        )
        .order_by("is_sample", "is_active", "name", "id")
    )


def workspace_invitations(user: AppUser):
    workspace = _selected_workspace(user)
    _require_owner(user, workspace)
    return WorkspaceInvitation.objects.filter(workspace=workspace).select_related("target_member")


def _mark_collaboration_error(workspace_id: UUID, code: str) -> None:
    Workspace.objects.filter(id=workspace_id).update(
        collaboration_state=Workspace.CollaborationState.ERROR,
        collaboration_error_code=code[:64],
        updated_at=timezone.now(),
    )


def activate_collaboration(*, user: AppUser, name: str | None = None) -> Workspace:
    workspace = _selected_workspace(user, allow_unselected=True)
    _require_owner(user, workspace)
    if workspace.collaboration_state == Workspace.CollaborationState.ACTIVE:
        return workspace
    if name:
        workspace.name = name.strip()[:120]
    elif workspace.name == "Personal workspace":
        owner_name = user.display_name or (user.email or "OpsPilot").split("@")[0]
        workspace.name = f"{owner_name}'s workspace"[:120]
    workspace.collaboration_state = Workspace.CollaborationState.PROVISIONING
    workspace.collaboration_error_code = ""
    workspace.save(
        update_fields=["name", "collaboration_state", "collaboration_error_code", "updated_at"]
    )

    directory = get_workos_directory()
    try:
        if not workspace.workos_organization_id:
            organization = directory.create_organization(
                name=workspace.name,
                external_id=str(workspace.id),
            )
            workspace.workos_organization_id = organization.id
            workspace.save(update_fields=["workos_organization_id", "updated_at"])
        try:
            membership = directory.create_membership(
                organization_id=workspace.workos_organization_id,
                user_id=user.workos_user_id,
            )
        except OpsPilotError as exc:
            if exc.code != "WORKOS_CONFLICT":
                raise
            membership = next(
                (
                    item
                    for item in directory.list_memberships(
                        organization_id=workspace.workos_organization_id
                    )
                    if item.user_id == user.workos_user_id
                ),
                None,
            )
            if membership is None:
                raise
    except OpsPilotError as exc:
        _mark_collaboration_error(workspace.id, exc.code)
        raise

    now = timezone.now()
    with transaction.atomic():
        locked = Workspace.objects.select_for_update().get(id=workspace.id)
        owner = WorkspaceMember.objects.select_for_update().get(
            workspace=locked,
            app_user=user,
        )
        owner.workos_membership_id = membership.id
        owner.membership_state = WorkspaceMember.MembershipState.ACTIVE
        owner.joined_at = owner.joined_at or membership.created_at
        owner.external_updated_at = membership.updated_at
        owner.save(
            update_fields=[
                "workos_membership_id",
                "membership_state",
                "joined_at",
                "external_updated_at",
                "updated_at",
            ]
        )
        locked.collaboration_state = Workspace.CollaborationState.ACTIVE
        locked.collaboration_enabled_at = locked.collaboration_enabled_at or now
        locked.collaboration_error_code = ""
        locked.workos_synced_at = now
        locked.save(
            update_fields=[
                "collaboration_state",
                "collaboration_enabled_at",
                "collaboration_error_code",
                "workos_synced_at",
                "updated_at",
            ]
        )
    return Workspace.objects.get(id=workspace.id)


def invite_workspace_member(
    *,
    user: AppUser,
    email: str,
    access_role: str,
    target_member_id: UUID | None = None,
) -> WorkspaceInvitation:
    normalized_email = email.strip().lower()
    try:
        validate_email(normalized_email)
    except ValidationError as exc:
        raise OpsPilotError(
            code="INVALID_INVITATION_EMAIL",
            message="Enter a valid work email address.",
            status=422,
            field_errors={"email": ["Enter a valid email address."]},
        ) from exc
    if access_role not in MANAGED_INVITE_ROLES:
        raise OpsPilotError(
            code="INVALID_MEMBER_ROLE",
            message="Invite a member as operator, contributor, or viewer.",
            status=422,
        )
    workspace = activate_collaboration(user=user)
    _require_owner(user, workspace)
    if WorkspaceMember.objects.filter(
        workspace=workspace,
        email__iexact=normalized_email,
        is_active=True,
    ).exists():
        raise OpsPilotError(
            code="MEMBER_ALREADY_ACTIVE",
            message="That email already belongs to an active workspace member.",
            status=409,
        )
    try:
        with transaction.atomic():
            target = None
            if target_member_id:
                target = (
                    WorkspaceMember.objects.select_for_update()
                    .filter(
                        id=target_member_id,
                        workspace=workspace,
                        is_sample=True,
                        app_user__isnull=True,
                        is_active=True,
                    )
                    .first()
                )
                if target is None:
                    raise OpsPilotError(
                        code="INVALID_SAMPLE_REPLACEMENT",
                        message="Choose an available sample profile to replace.",
                        status=422,
                    )
                if WorkspaceInvitation.objects.filter(
                    workspace=workspace,
                    target_member=target,
                    state=WorkspaceInvitation.State.PENDING,
                ).exists():
                    raise OpsPilotError(
                        code="SAMPLE_REPLACEMENT_RESERVED",
                        message="That sample profile is already reserved by a pending invitation.",
                        status=409,
                    )
            local = WorkspaceInvitation.objects.create(
                workspace=workspace,
                email=normalized_email,
                access_role=access_role,
                target_member=target,
                invited_by=user,
            )
    except IntegrityError as exc:
        if (
            target_member_id
            and WorkspaceInvitation.objects.filter(
                workspace=workspace,
                target_member_id=target_member_id,
                state=WorkspaceInvitation.State.PENDING,
            ).exists()
        ):
            raise OpsPilotError(
                code="SAMPLE_REPLACEMENT_RESERVED",
                message="That sample profile is already reserved by a pending invitation.",
                status=409,
            ) from exc
        raise OpsPilotError(
            code="INVITATION_ALREADY_PENDING",
            message="That email already has a pending invitation.",
            status=409,
        ) from exc
    try:
        external = get_workos_directory().send_invitation(
            organization_id=workspace.workos_organization_id,
            email=normalized_email,
            inviter_user_id=user.workos_user_id,
            expires_in_days=settings.WORKOS_INVITATION_EXPIRY_DAYS,
        )
    except OpsPilotError as exc:
        WorkspaceInvitation.objects.filter(id=local.id).update(
            state=WorkspaceInvitation.State.FAILED,
            failure_code=exc.code,
            updated_at=timezone.now(),
        )
        raise
    _apply_invitation_snapshot(local, external)
    return WorkspaceInvitation.objects.select_related("target_member").get(id=local.id)


def _apply_invitation_snapshot(
    invitation: WorkspaceInvitation,
    external: DirectoryInvitation,
) -> None:
    state = (
        external.state if external.state in WorkspaceInvitation.State.values else invitation.state
    )
    invitation.workos_invitation_id = external.id
    invitation.state = state
    invitation.accepted_at = external.accepted_at
    invitation.revoked_at = external.revoked_at
    invitation.expires_at = external.expires_at
    invitation.external_updated_at = external.updated_at
    invitation.failure_code = ""
    invitation.save()


def revoke_workspace_invitation(*, user: AppUser, invitation_id: UUID) -> WorkspaceInvitation:
    workspace = _selected_workspace(user)
    _require_owner(user, workspace)
    invitation = WorkspaceInvitation.objects.filter(
        id=invitation_id,
        workspace=workspace,
    ).first()
    if invitation is None:
        raise OpsPilotError(code="NOT_FOUND", message="That invitation was not found.", status=404)
    if invitation.state != WorkspaceInvitation.State.PENDING:
        raise OpsPilotError(
            code="INVITATION_NOT_PENDING",
            message="Only a pending invitation can be revoked.",
            status=409,
        )
    external = get_workos_directory().revoke_invitation(invitation.workos_invitation_id)
    _apply_invitation_snapshot(invitation, external)
    return invitation


def resend_workspace_invitation(*, user: AppUser, invitation_id: UUID) -> WorkspaceInvitation:
    workspace = _selected_workspace(user)
    _require_owner(user, workspace)
    invitation = WorkspaceInvitation.objects.filter(
        id=invitation_id,
        workspace=workspace,
    ).first()
    if invitation is None:
        raise OpsPilotError(code="NOT_FOUND", message="That invitation was not found.", status=404)
    if invitation.state == WorkspaceInvitation.State.PENDING and invitation.workos_invitation_id:
        revoked = get_workos_directory().revoke_invitation(invitation.workos_invitation_id)
        _apply_invitation_snapshot(invitation, revoked)
    try:
        with transaction.atomic():
            invitation = WorkspaceInvitation.objects.select_for_update().get(id=invitation.id)
            if invitation.target_member_id:
                target = (
                    WorkspaceMember.objects.select_for_update()
                    .filter(
                        id=invitation.target_member_id,
                        workspace=workspace,
                        is_sample=True,
                        app_user__isnull=True,
                        is_active=True,
                    )
                    .first()
                )
                if target is None:
                    raise OpsPilotError(
                        code="INVALID_SAMPLE_REPLACEMENT",
                        message="That sample profile is no longer available to replace.",
                        status=409,
                    )
                if (
                    WorkspaceInvitation.objects.filter(
                        workspace=workspace,
                        target_member=target,
                        state=WorkspaceInvitation.State.PENDING,
                    )
                    .exclude(id=invitation.id)
                    .exists()
                ):
                    raise OpsPilotError(
                        code="SAMPLE_REPLACEMENT_RESERVED",
                        message="That sample profile is already reserved by a pending invitation.",
                        status=409,
                    )
            invitation.state = WorkspaceInvitation.State.PENDING
            invitation.failure_code = ""
            invitation.save(update_fields=["state", "failure_code", "updated_at"])
    except IntegrityError as exc:
        if (
            invitation.target_member_id
            and WorkspaceInvitation.objects.filter(
                workspace=workspace,
                target_member_id=invitation.target_member_id,
                state=WorkspaceInvitation.State.PENDING,
            )
            .exclude(id=invitation.id)
            .exists()
        ):
            raise OpsPilotError(
                code="SAMPLE_REPLACEMENT_RESERVED",
                message="That sample profile is already reserved by a pending invitation.",
                status=409,
            ) from exc
        raise OpsPilotError(
            code="INVITATION_ALREADY_PENDING",
            message="That email already has a pending invitation.",
            status=409,
        ) from exc
    try:
        external = get_workos_directory().send_invitation(
            organization_id=workspace.workos_organization_id,
            email=invitation.email,
            inviter_user_id=user.workos_user_id,
            expires_in_days=settings.WORKOS_INVITATION_EXPIRY_DAYS,
        )
    except OpsPilotError as exc:
        invitation.state = WorkspaceInvitation.State.FAILED
        invitation.failure_code = exc.code
        invitation.save(update_fields=["state", "failure_code", "updated_at"])
        raise
    _apply_invitation_snapshot(invitation, external)
    return invitation


def update_workspace_member(
    *,
    user: AppUser,
    member_id: UUID,
    access_role: str | None = None,
    active: bool | None = None,
) -> WorkspaceMember:
    workspace = _selected_workspace(user)
    _require_owner(user, workspace)
    member = WorkspaceMember.objects.filter(id=member_id, workspace=workspace).first()
    if member is None:
        raise OpsPilotError(code="NOT_FOUND", message="That member was not found.", status=404)
    if member.access_role == WorkspaceMember.AccessRole.OWNER:
        raise OpsPilotError(
            code="LAST_OWNER_PROTECTED",
            message="The workspace owner cannot be demoted or removed.",
            status=409,
        )
    if access_role is not None:
        if access_role not in MANAGED_INVITE_ROLES:
            raise OpsPilotError(
                code="INVALID_MEMBER_ROLE",
                message="Choose operator, contributor, or viewer.",
                status=422,
            )
        member.access_role = access_role
    if active is False and member.is_active:
        if member.workos_membership_id:
            get_workos_directory().deactivate_membership(member.workos_membership_id)
        member.is_active = False
        member.membership_state = WorkspaceMember.MembershipState.INACTIVE
        member.deactivated_at = timezone.now()
    elif active is True and not member.is_active:
        raise OpsPilotError(
            code="MEMBER_REINVITE_REQUIRED",
            message="Invite this person again to restore an inactive WorkOS membership.",
            status=409,
        )
    member.save()
    return member


def _upsert_external_membership(
    *,
    workspace: Workspace,
    external: DirectoryMembership,
) -> WorkspaceMember:
    user, _ = AppUser.objects.get_or_create(
        workos_user_id=external.user_id,
        defaults={"email": external.email, "display_name": external.name or None},
    )
    updates = []
    if external.email and user.email != external.email:
        user.email = external.email
        updates.append("email")
    if external.name and user.display_name != external.name:
        user.display_name = external.name
        updates.append("display_name")
    if updates:
        user.save(update_fields=[*updates, "updated_at"])
    member = WorkspaceMember.objects.filter(workspace=workspace, app_user=user).first()
    if member is None:
        member = _link_user_from_invitation(
            workspace=workspace,
            user=user,
            email=external.email,
            name=external.name,
            membership_id=external.id,
            external_updated_at=external.updated_at,
        )
    if member.external_updated_at and member.external_updated_at > external.updated_at:
        return member
    active = external.status == "active"
    member.workos_membership_id = external.id
    member.external_updated_at = external.updated_at
    member.is_active = active
    member.membership_state = (
        WorkspaceMember.MembershipState.ACTIVE
        if active
        else WorkspaceMember.MembershipState.INACTIVE
    )
    member.deactivated_at = None if active else timezone.now()
    member.joined_at = member.joined_at or external.created_at
    member.save()
    return member


def reconcile_workspace(*, user: AppUser) -> dict:
    workspace = _selected_workspace(user)
    _require_owner(user, workspace)
    if not workspace.workos_organization_id:
        raise OpsPilotError(
            code="COLLABORATION_NOT_ACTIVE",
            message="Enable collaboration before synchronizing members.",
            status=409,
        )
    directory = get_workos_directory()
    memberships = directory.list_memberships(organization_id=workspace.workos_organization_id)
    invitations = directory.list_invitations(organization_id=workspace.workos_organization_id)
    for external in memberships:
        _upsert_external_membership(workspace=workspace, external=external)
    for external in invitations:
        local = WorkspaceInvitation.objects.filter(
            workspace=workspace,
            workos_invitation_id=external.id,
        ).first()
        if local:
            _apply_invitation_snapshot(local, external)
    workspace.workos_synced_at = timezone.now()
    workspace.collaboration_state = Workspace.CollaborationState.ACTIVE
    workspace.collaboration_error_code = ""
    workspace.save(
        update_fields=[
            "workos_synced_at",
            "collaboration_state",
            "collaboration_error_code",
            "updated_at",
        ]
    )
    return {"memberCount": len(memberships), "invitationCount": len(invitations)}


def _directory_user(user_id: str) -> DirectoryUser:
    return get_workos_directory().get_user(user_id)


def _event_datetime(value) -> datetime | None:
    if isinstance(value, datetime):
        return value
    return parse_datetime(value) if isinstance(value, str) else None


@transaction.atomic
def process_workos_event(event) -> bool:
    payload = event.to_dict()
    event_id = payload.get("id", "")
    event_type = payload.get("event", "")
    data = payload.get("data") or {}
    organization_id = data.get("organization_id") or ""
    object_id = data.get("id") or ""
    external_updated_at = _event_datetime(data.get("updated_at"))
    if not event_id or not event_type:
        raise OpsPilotError(
            code="INVALID_WORKOS_EVENT",
            message="The WorkOS event payload is incomplete.",
            status=422,
        )
    receipt, _ = WorkOSEventReceipt.objects.get_or_create(
        event_id=event_id,
        defaults={
            "event_type": event_type,
            "workos_organization_id": organization_id,
            "object_id": object_id,
            "external_updated_at": external_updated_at,
        },
    )
    receipt = WorkOSEventReceipt.objects.select_for_update().get(event_id=receipt.event_id)
    if receipt.processed_at:
        return False

    workspace = Workspace.objects.filter(workos_organization_id=organization_id).first()
    if workspace and event_type.startswith("organization_membership."):
        user_id = data.get("user_id")
        if user_id:
            directory_user = _directory_user(user_id)
            external = DirectoryMembership(
                id=object_id,
                user_id=user_id,
                organization_id=organization_id,
                status="inactive" if event_type.endswith(".deleted") else str(data.get("status")),
                email=directory_user.email,
                name=directory_user.name,
                created_at=_event_datetime(data.get("created_at")) or timezone.now(),
                updated_at=external_updated_at or timezone.now(),
            )
            _upsert_external_membership(workspace=workspace, external=external)
    elif workspace and event_type.startswith("invitation."):
        invitation = WorkspaceInvitation.objects.filter(
            workspace=workspace,
            workos_invitation_id=object_id,
        ).first()
        if invitation:
            state = str(data.get("state") or invitation.state)
            if state in WorkspaceInvitation.State.values:
                invitation.state = state
            invitation.accepted_at = _event_datetime(data.get("accepted_at"))
            invitation.revoked_at = _event_datetime(data.get("revoked_at"))
            invitation.external_updated_at = external_updated_at
            accepted_user_id = data.get("accepted_user_id")
            if accepted_user_id:
                directory_user = _directory_user(accepted_user_id)
                accepted_user, _ = AppUser.objects.get_or_create(
                    workos_user_id=accepted_user_id,
                    defaults={
                        "email": directory_user.email,
                        "display_name": directory_user.name or None,
                    },
                )
                invitation.accepted_user = accepted_user
                _link_user_from_invitation(
                    workspace=workspace,
                    user=accepted_user,
                    email=directory_user.email,
                    name=directory_user.name,
                    external_updated_at=external_updated_at,
                )
            invitation.save()
    receipt.processed_at = timezone.now()
    receipt.save(update_fields=["processed_at"])
    return True
