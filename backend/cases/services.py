from datetime import date
from uuid import UUID

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from accounts.models import AppUser
from cases.models import (
    CaseAssessment,
    CaseAssignment,
    CaseDomainEvent,
    CaseEvent,
    CaseEvidence,
    OperationsCase,
    Workspace,
    WorkspaceMember,
)
from cases.sample_team import SAMPLE_TEAM_MEMBERS
from cases.selectors import case_for_user, member_for_user, require_case_manager
from common.errors import OpsPilotError

ALLOWED_STATUS_TRANSITIONS = {
    OperationsCase.Status.NEW: {
        OperationsCase.Status.TRIAGING,
        OperationsCase.Status.NEEDS_INFORMATION,
        OperationsCase.Status.ACTION_REQUIRED,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.TRIAGING: {
        OperationsCase.Status.NEEDS_INFORMATION,
        OperationsCase.Status.ACTION_REQUIRED,
        OperationsCase.Status.IN_PROGRESS,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.NEEDS_INFORMATION: {
        OperationsCase.Status.TRIAGING,
        OperationsCase.Status.ACTION_REQUIRED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.ACTION_REQUIRED: {
        OperationsCase.Status.NEEDS_INFORMATION,
        OperationsCase.Status.IN_PROGRESS,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.IN_PROGRESS: {
        OperationsCase.Status.NEEDS_INFORMATION,
        OperationsCase.Status.VERIFICATION,
        OperationsCase.Status.MONITORING,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.MONITORING: {
        OperationsCase.Status.IN_PROGRESS,
        OperationsCase.Status.VERIFICATION,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.RESOLVED: {
        OperationsCase.Status.MONITORING,
        OperationsCase.Status.VERIFICATION,
        OperationsCase.Status.TRIAGING,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.CLOSED: {OperationsCase.Status.TRIAGING},
    OperationsCase.Status.VERIFICATION: {
        OperationsCase.Status.IN_PROGRESS,
        OperationsCase.Status.NEEDS_INFORMATION,
        OperationsCase.Status.MONITORING,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
}


def _owner_member_defaults(user: AppUser) -> dict:
    display_name = user.display_name or user.email or "Workspace owner"
    initials = "".join(part[0] for part in display_name.split()[:2]).upper() or "WO"
    return {
        "key": "workspace-owner",
        "name": display_name[:120],
        "email": user.email,
        "initials": initials[:4],
        "role": "Workspace owner",
        "discipline": "Operations",
        "focus": "Owns this personal workspace and approves case routing decisions.",
        "availability": "Available",
        "workflow_fit": ["Case ownership", "Final review"],
        "tone": WorkspaceMember.Tone.NEUTRAL,
        "is_sample": False,
        "is_active": True,
        "membership_state": WorkspaceMember.MembershipState.ACTIVE,
        "access_role": WorkspaceMember.AccessRole.OWNER,
    }


@transaction.atomic
def ensure_personal_workspace(user: AppUser) -> Workspace:
    selected_workspace_id = getattr(user, "_opspilot_workspace_id", None)
    if selected_workspace_id is not None:
        workspace = Workspace.objects.filter(
            id=selected_workspace_id,
            members__app_user=user,
            members__is_active=True,
        ).first()
        if workspace is None:
            raise OpsPilotError(
                code="WORKSPACE_ACCESS_DENIED",
                message="Your account is not an active member of this workspace.",
                status=403,
            )
        if (
            getattr(user, "_opspilot_auth_context", False)
            and not getattr(user, "_opspilot_organization_id", None)
            and workspace.collaboration_state == Workspace.CollaborationState.ACTIVE
        ):
            raise OpsPilotError(
                code="WORKSPACE_SELECTION_REQUIRED",
                message="Select this workspace again to refresh its organization session.",
                status=409,
            )
        return workspace
    workspace, _ = Workspace.objects.get_or_create(
        owner=user,
        defaults={"name": "Personal workspace"},
    )
    owner_member, _ = WorkspaceMember.objects.update_or_create(
        workspace=workspace,
        app_user=user,
        defaults=_owner_member_defaults(user),
    )
    if owner_member.joined_at is None:
        owner_member.joined_at = owner_member.created_at or timezone.now()
        owner_member.save(update_fields=["joined_at", "updated_at"])
    for member in SAMPLE_TEAM_MEMBERS:
        sample, created = WorkspaceMember.objects.get_or_create(
            workspace=workspace,
            key=member["key"],
            defaults={
                **member,
                "app_user": None,
                "is_sample": True,
                "is_active": True,
                "membership_state": WorkspaceMember.MembershipState.SAMPLE,
                "access_role": WorkspaceMember.AccessRole.CONTRIBUTOR,
            },
        )
        if not created and sample.app_user_id is None:
            for field, value in member.items():
                setattr(sample, field, value)
            sample.is_sample = True
            sample.is_active = True
            sample.membership_state = WorkspaceMember.MembershipState.SAMPLE
            sample.access_role = WorkspaceMember.AccessRole.CONTRIBUTOR
            sample.save(
                update_fields=[
                    *member.keys(),
                    "is_sample",
                    "is_active",
                    "membership_state",
                    "access_role",
                    "updated_at",
                ]
            )
    return workspace


def record_case_event(
    *,
    case: OperationsCase,
    event_type: str,
    actor: AppUser | None,
    payload: dict | None = None,
) -> CaseEvent:
    return CaseEvent.objects.create(
        case=case,
        actor=actor,
        event_type=event_type,
        payload=payload or {},
    )


def record_domain_event(
    *,
    case: OperationsCase,
    event_type: str,
    actor: AppUser | None,
    payload: dict | None = None,
) -> CaseDomainEvent:
    """Persist a notification-ready event without performing external delivery."""
    return CaseDomainEvent.objects.create(
        case=case,
        actor=actor,
        event_type=event_type,
        payload=payload or {},
    )


@transaction.atomic
def create_case(
    *,
    user: AppUser,
    title: str,
    description: str,
    intent: str = OperationsCase.Intent.ISSUE,
    affected_area: str = "",
    expected_outcome: str = "",
    environment_context: str = "",
    settings_context: str = "",
    constraints: str = "",
    evidence_notes: list[str] | None = None,
    summary: str = "",
    disposition: str = OperationsCase.Disposition.UNCLASSIFIED,
    due_date: date | None = None,
    assignee_id: UUID | None = None,
) -> OperationsCase:
    workspace = ensure_personal_workspace(user)
    locked_workspace = Workspace.objects.select_for_update().get(pk=workspace.pk)
    current_number = (
        OperationsCase.objects.filter(workspace=locked_workspace).aggregate(Max("number"))[
            "number__max"
        ]
        or 0
    )
    case = OperationsCase.objects.create(
        workspace=locked_workspace,
        number=current_number + 1,
        title=title,
        description=description,
        intent=intent,
        publication_state=OperationsCase.PublicationState.DRAFT,
        affected_area=affected_area,
        expected_outcome=expected_outcome,
        environment_context=environment_context,
        settings_context=settings_context,
        constraints=constraints,
        summary=summary,
        status=OperationsCase.Status.NEW,
        disposition=disposition,
        due_date=due_date,
        created_by=user,
    )
    record_case_event(
        case=case,
        event_type=CaseEvent.Type.CREATED,
        actor=user,
        payload={
            "status": case.status,
            "disposition": case.disposition,
            "intent": case.intent,
            "publicationState": case.publication_state,
        },
    )
    for index, note in enumerate(evidence_notes or []):
        evidence = CaseEvidence.objects.create(
            case=case,
            created_by=user,
            kind=CaseEvidence.Kind.TEXT,
            text=note,
            sort_order=index,
        )
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.EVIDENCE_ADDED,
            actor=user,
            payload={"evidenceId": str(evidence.id), "kind": evidence.kind},
        )
    if assignee_id is not None:
        assign_case(user=user, case_id=case.id, assignee_id=assignee_id)
    return case_for_user(user=user, case_id=case.id, detail=True)


@transaction.atomic
def update_case(
    *,
    user: AppUser,
    case_id: UUID,
    status: str | None = None,
    disposition: str | None = None,
    confidence: float | None = None,
    confidence_supplied: bool = False,
    due_date: date | None = None,
    due_date_supplied: bool = False,
    resolution_summary: str | None = None,
    publication_state: str | None = None,
) -> OperationsCase:
    case = case_for_user(user=user, case_id=case_id, for_update=True)
    require_case_manager(user=user, case=case)
    update_fields: list[str] = []
    now = timezone.now()
    if status is not None and status != case.status:
        if status not in ALLOWED_STATUS_TRANSITIONS.get(case.status, set()):
            raise OpsPilotError(
                code="INVALID_CASE_TRANSITION",
                message=f"A case cannot move directly from {case.status} to {status}.",
                status=409,
            )
        previous = case.status
        case.status = status
        update_fields.append("status")
        if status == OperationsCase.Status.RESOLVED:
            case.resolved_at = now
            update_fields.append("resolved_at")
        elif previous == OperationsCase.Status.RESOLVED and status != OperationsCase.Status.CLOSED:
            case.resolved_at = None
            update_fields.append("resolved_at")
        if status == OperationsCase.Status.CLOSED:
            case.closed_at = now
            update_fields.append("closed_at")
        elif previous == OperationsCase.Status.CLOSED:
            case.closed_at = None
            update_fields.append("closed_at")
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.STATUS_CHANGED,
            actor=user,
            payload={"from": previous, "to": status},
        )
    if disposition is not None and disposition != case.disposition:
        previous = case.disposition
        case.disposition = disposition
        update_fields.append("disposition")
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.DISPOSITION_CHANGED,
            actor=user,
            payload={"from": previous, "to": disposition},
        )
    if confidence_supplied and confidence != case.confidence:
        case.confidence = confidence
        update_fields.append("confidence")
    if due_date_supplied and due_date != case.due_date:
        case.due_date = due_date
        update_fields.append("due_date")
    if resolution_summary is not None and resolution_summary != case.resolution_summary:
        case.resolution_summary = resolution_summary
        update_fields.append("resolution_summary")
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.RESOLUTION_RECORDED,
            actor=user,
            payload={"recorded": bool(resolution_summary)},
        )
    if publication_state is not None and publication_state != case.publication_state:
        if publication_state == OperationsCase.PublicationState.DRAFT:
            if case.publication_state != OperationsCase.PublicationState.ARCHIVED:
                raise OpsPilotError(
                    code="INVALID_PUBLICATION_TRANSITION",
                    message="Only an archived case can return to draft.",
                    status=409,
                )
            case.publication_state = OperationsCase.PublicationState.DRAFT
            update_fields.append("publication_state")
        elif publication_state == OperationsCase.PublicationState.ARCHIVED:
            case.publication_state = OperationsCase.PublicationState.ARCHIVED
            update_fields.append("publication_state")
            record_case_event(
                case=case,
                event_type=CaseEvent.Type.ARCHIVED,
                actor=user,
            )
    if update_fields:
        case.save(update_fields=[*dict.fromkeys(update_fields), "updated_at"])
    return case_for_user(user=user, case_id=case.id, detail=True)


@transaction.atomic
def assign_case(
    *,
    user: AppUser,
    case_id: UUID,
    assignee_id: UUID | None,
) -> OperationsCase:
    case = case_for_user(user=user, case_id=case_id, for_update=True)
    require_case_manager(user=user, case=case)
    assignee = member_for_user(user=user, member_id=assignee_id) if assignee_id else None
    if assignee is not None and case.publication_state != OperationsCase.PublicationState.PUBLISHED:
        _publish_locked_case(case=case, user=user, override_advisory=True)
    assignment, _ = CaseAssignment.objects.select_for_update().get_or_create(case=case)
    previous = assignment.assignee
    if previous != assignee:
        assignment.assignee = assignee
        assignment.assigned_by = user
        assignment.save(update_fields=["assignee", "assigned_by", "updated_at"])
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.ASSIGNMENT_CHANGED,
            actor=user,
            payload={
                "fromMemberId": str(previous.id) if previous else None,
                "fromMemberName": previous.name if previous else None,
                "toMemberId": str(assignee.id) if assignee else None,
                "toMemberName": assignee.name if assignee else None,
            },
        )
        record_domain_event(
            case=case,
            event_type="case.assignment.changed",
            actor=user,
            payload={
                "fromMemberId": str(previous.id) if previous else None,
                "toMemberId": str(assignee.id) if assignee else None,
            },
        )
        case.save(update_fields=["updated_at"])
    return case_for_user(user=user, case_id=case.id, detail=True)


def _publish_locked_case(
    *,
    case: OperationsCase,
    user: AppUser,
    assessment: CaseAssessment | None = None,
    override_advisory: bool = False,
) -> None:
    if case.publication_state == OperationsCase.PublicationState.PUBLISHED:
        return
    case.publication_state = OperationsCase.PublicationState.PUBLISHED
    case.published_at = timezone.now()
    case.published_by = user
    case.published_assessment = assessment
    case.save(
        update_fields=[
            "publication_state",
            "published_at",
            "published_by",
            "published_assessment",
            "updated_at",
        ]
    )
    record_case_event(
        case=case,
        event_type=CaseEvent.Type.PUBLISHED,
        actor=user,
        payload={
            "publicationState": case.publication_state,
            "assessmentId": str(assessment.id) if assessment else None,
            "assessmentSequence": assessment.sequence if assessment else None,
            "advisoryOverride": override_advisory,
        },
    )
    record_domain_event(
        case=case,
        event_type="case.published",
        actor=user,
        payload={
            "assessmentId": str(assessment.id) if assessment else None,
            "advisoryOverride": override_advisory,
        },
    )


@transaction.atomic
def publish_case(
    *,
    user: AppUser,
    case_id: UUID,
    assignee_id: UUID | None = None,
    assessment_id: UUID | None = None,
    override_advisory: bool = False,
) -> OperationsCase:
    case = case_for_user(user=user, case_id=case_id, for_update=True)
    require_case_manager(user=user, case=case)
    assessment = None
    if assessment_id is not None:
        assessment = CaseAssessment.objects.filter(id=assessment_id, case=case).first()
        if assessment is None or not assessment.is_applied:
            raise OpsPilotError(
                code="INVALID_PUBLICATION_ADVISORY",
                message="Choose an advisory assessment that was reviewed and applied to this case.",
                status=422,
            )
    elif case.intent == OperationsCase.Intent.ISSUE:
        assessment = CaseAssessment.objects.filter(case=case, is_applied=True).first()
    if case.intent == OperationsCase.Intent.ISSUE and assessment is None and not override_advisory:
        raise OpsPilotError(
            code="ADVISORY_REVIEW_REQUIRED",
            message=(
                "Review and apply an advisory assessment before publishing, "
                "or explicitly publish without one."
            ),
            status=409,
        )
    _publish_locked_case(
        case=case,
        user=user,
        assessment=assessment,
        override_advisory=override_advisory,
    )
    if assignee_id is not None:
        return assign_case(user=user, case_id=case.id, assignee_id=assignee_id)
    return case_for_user(user=user, case_id=case.id, detail=True)


def record_workflow_link(*, case: OperationsCase, run, actor: AppUser) -> None:
    record_case_event(
        case=case,
        event_type=CaseEvent.Type.WORKFLOW_LINKED,
        actor=actor,
        payload={
            "runId": str(run.id),
            "workflowId": run.workflow_id,
            "status": run.status,
        },
    )
    case.save(update_fields=["updated_at"])
