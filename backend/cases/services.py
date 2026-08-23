from datetime import date
from uuid import UUID

from django.db import transaction
from django.db.models import Max
from django.utils import timezone

from accounts.models import AppUser
from cases.models import CaseAssignment, CaseEvent, OperationsCase, Workspace, WorkspaceMember
from cases.sample_team import SAMPLE_TEAM_MEMBERS
from cases.selectors import case_for_user, member_for_user
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
        OperationsCase.Status.MONITORING,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.MONITORING: {
        OperationsCase.Status.IN_PROGRESS,
        OperationsCase.Status.RESOLVED,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.RESOLVED: {
        OperationsCase.Status.MONITORING,
        OperationsCase.Status.TRIAGING,
        OperationsCase.Status.CLOSED,
    },
    OperationsCase.Status.CLOSED: {OperationsCase.Status.TRIAGING},
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
    }


@transaction.atomic
def ensure_personal_workspace(user: AppUser) -> Workspace:
    workspace, _ = Workspace.objects.get_or_create(
        owner=user,
        defaults={"name": "Personal workspace"},
    )
    WorkspaceMember.objects.update_or_create(
        workspace=workspace,
        app_user=user,
        defaults=_owner_member_defaults(user),
    )
    for member in SAMPLE_TEAM_MEMBERS:
        WorkspaceMember.objects.update_or_create(
            workspace=workspace,
            key=member["key"],
            defaults={**member, "app_user": None, "is_sample": True, "is_active": True},
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


@transaction.atomic
def create_case(
    *,
    user: AppUser,
    title: str,
    description: str,
    summary: str,
    disposition: str,
    due_date: date | None,
    assignee_id: UUID | None,
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
        payload={"status": case.status, "disposition": case.disposition},
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
) -> OperationsCase:
    case = case_for_user(user=user, case_id=case_id)
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
    case = case_for_user(user=user, case_id=case_id)
    assignee = member_for_user(user=user, member_id=assignee_id) if assignee_id else None
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
        case.save(update_fields=["updated_at"])
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
