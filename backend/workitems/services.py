from uuid import UUID

from django.db import transaction
from django.utils import timezone

from accounts.models import AppUser
from cases.models import CaseEvent
from cases.selectors import case_for_user, member_for_user
from cases.services import record_case_event
from common.errors import OpsPilotError
from runs.models import WorkflowRun
from runs.selectors import run_for_user
from workitems.models import WorkflowHandoff, WorkItem


def _handoff_dict(handoff: WorkflowHandoff) -> dict:
    return {
        "id": handoff.id,
        "caseId": handoff.case_id,
        "sourceRunId": handoff.source_run_id,
        "target": handoff.target,
        "status": handoff.status,
        "draftInput": handoff.draft_input,
        "targetRunId": handoff.target_run_id,
        "createdAt": handoff.created_at,
        "convertedAt": handoff.converted_at,
    }


@transaction.atomic
def create_handoff(*, user: AppUser, run_id: UUID, target: str) -> dict:
    source = run_for_user(user=user, run_id=run_id)
    if source.status != WorkflowRun.Status.COMPLETED or not source.result_json:
        raise OpsPilotError(
            code="RUN_NOT_ACTIONABLE",
            message="Complete this workflow before creating a handoff.",
            status=409,
        )
    draft_input = build_handoff_input(source=source, target=target)
    handoff, created = WorkflowHandoff.objects.get_or_create(
        user=user,
        source_run=source,
        target=target,
        status=WorkflowHandoff.Status.DRAFT,
        defaults={"draft_input": draft_input, "case": source.case},
    )
    update_fields: list[str] = []
    if not created and handoff.draft_input != draft_input:
        handoff.draft_input = draft_input
        update_fields.append("draft_input")
    if not created and handoff.case_id != source.case_id:
        handoff.case = source.case
        update_fields.append("case")
    if update_fields:
        handoff.save(update_fields=update_fields)
    return _handoff_dict(handoff)


def handoff_for_user(*, user: AppUser, handoff_id: UUID) -> WorkflowHandoff:
    handoff = (
        WorkflowHandoff.objects.select_related("source_run", "target_run")
        .filter(user=user, id=handoff_id)
        .first()
    )
    if handoff is None:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That workflow draft was not found.",
            status=404,
        )
    return handoff


def get_handoff(*, user: AppUser, handoff_id: UUID) -> dict:
    return _handoff_dict(handoff_for_user(user=user, handoff_id=handoff_id))


def validate_run_handoff(*, user: AppUser, handoff_id: UUID | None, workflow_id: str) -> None:
    if handoff_id is None:
        return
    handoff = handoff_for_user(user=user, handoff_id=handoff_id)
    if handoff.status != WorkflowHandoff.Status.DRAFT or handoff.target != workflow_id:
        raise OpsPilotError(
            code="INVALID_HANDOFF_TARGET",
            message="That workflow draft is no longer available for this workflow.",
            status=422,
        )


@transaction.atomic
def complete_run_handoff(
    *, user: AppUser, handoff_id: UUID | None, workflow_id: str, run: WorkflowRun
) -> None:
    if handoff_id is None:
        return
    handoff = handoff_for_user(user=user, handoff_id=handoff_id)
    validate_run_handoff(user=user, handoff_id=handoff_id, workflow_id=workflow_id)
    handoff.status = WorkflowHandoff.Status.CONVERTED
    handoff.target_run = run
    handoff.converted_at = timezone.now()
    handoff.save(update_fields=["status", "target_run", "converted_at"])


@transaction.atomic
def create_work_item(
    *,
    user: AppUser,
    handoff_id: UUID | None,
    title: str,
    description: str,
    kind: str,
    assignee_id: UUID | None,
    case_id: UUID | None,
    due_date,
) -> WorkItem:
    handoff = handoff_for_user(user=user, handoff_id=handoff_id) if handoff_id else None
    if handoff is not None and handoff.target != WorkflowHandoff.Target.WORK_ITEM:
        raise OpsPilotError(
            code="INVALID_HANDOFF_TARGET",
            message="That draft cannot create a work item.",
            status=422,
        )
    requested_case = case_for_user(user=user, case_id=case_id) if case_id else None
    if handoff is not None and requested_case is not None and handoff.case_id != requested_case.id:
        raise OpsPilotError(
            code="CASE_CONTEXT_MISMATCH",
            message="That work-item draft belongs to another operations case.",
            status=422,
        )
    case = requested_case or (handoff.case if handoff else None)
    assignee = member_for_user(user=user, member_id=assignee_id) if assignee_id else None
    item = WorkItem.objects.create(
        user=user,
        case=case,
        source_run=handoff.source_run if handoff else None,
        source_handoff=handoff,
        title=title,
        description=description,
        kind=kind,
        assignee=assignee,
        due_date=due_date,
    )
    if handoff is not None:
        handoff.status = WorkflowHandoff.Status.CONVERTED
        handoff.converted_at = timezone.now()
        handoff.save(update_fields=["status", "converted_at"])
    if case is not None:
        record_case_event(
            case=case,
            event_type=CaseEvent.Type.WORK_ITEM_CREATED,
            actor=user,
            payload={
                "workItemId": str(item.id),
                "title": item.title,
                "status": item.status,
                "assigneeId": str(assignee.id) if assignee else None,
                "assigneeName": assignee.name if assignee else None,
            },
        )
        case.save(update_fields=["updated_at"])
    return item


@transaction.atomic
def update_work_item(
    *,
    user: AppUser,
    item_id: UUID,
    status: str | None = None,
    assignee_id: UUID | None = None,
    assignee_supplied: bool = False,
    due_date=None,
    due_date_supplied: bool = False,
) -> WorkItem:
    item = (
        WorkItem.objects.select_for_update()
        .select_related("case", "assignee")
        .filter(user=user, id=item_id)
        .first()
    )
    if item is None:
        raise OpsPilotError(code="NOT_FOUND", message="That work item was not found.", status=404)
    changes: dict[str, dict] = {}
    update_fields: list[str] = []
    if status is not None and status != item.status:
        changes["status"] = {"from": item.status, "to": status}
        item.status = status
        update_fields.append("status")
    if assignee_supplied:
        assignee = member_for_user(user=user, member_id=assignee_id) if assignee_id else None
        if assignee != item.assignee:
            changes["assignee"] = {
                "fromMemberId": str(item.assignee_id) if item.assignee_id else None,
                "fromMemberName": item.assignee.name if item.assignee else None,
                "toMemberId": str(assignee.id) if assignee else None,
                "toMemberName": assignee.name if assignee else None,
            }
            item.assignee = assignee
            update_fields.append("assignee")
    if due_date_supplied and due_date != item.due_date:
        changes["dueDate"] = {
            "from": item.due_date.isoformat() if item.due_date else None,
            "to": due_date.isoformat() if due_date else None,
        }
        item.due_date = due_date
        update_fields.append("due_date")
    if update_fields:
        item.save(update_fields=[*update_fields, "updated_at"])
        if item.case is not None:
            record_case_event(
                case=item.case,
                event_type=CaseEvent.Type.WORK_ITEM_UPDATED,
                actor=user,
                payload={"workItemId": str(item.id), "title": item.title, "changes": changes},
            )
            item.case.save(update_fields=["updated_at"])
    return item


def build_handoff_input(*, source: WorkflowRun, target: str) -> dict:
    output = source.result_json or {}
    source_title = str(source.input_json.get("title") or "Workflow follow-up")
    summary = str(output.get("summary") or "Review the source workflow result.")
    owner_id = str((output.get("routing") or {}).get("ownerId") or "")
    if target == WorkflowHandoff.Target.MEETING_ACTIONS:
        checks = [str(item) for item in output.get("recommendedChecks", [])]
        gaps = [str(item) for item in output.get("evidenceGaps", [])]
        lines = [f"Decision context: {summary}"]
        lines.extend(f"Action: {item}" for item in checks)
        lines.extend(f"Open question: {item}" for item in gaps)
        return {
            "inputMode": "advanced",
            "title": f"Follow-up: {source_title}"[:200],
            "notes": "\n".join(lines),
            "participants": [],
            "date": "",
            "coordinatorId": owner_id,
        }
    if target == WorkflowHandoff.Target.STATUS_UPDATE:
        disposition = str(output.get("issueType") or "workflow-result")
        checks = [str(item) for item in output.get("recommendedChecks", [])]
        notes = [
            f"In progress: {summary}",
            f"Blocked: Classification requires human review ({disposition}).",
        ]
        notes.extend(f"Next: {item}" for item in checks)
        return {
            "inputMode": "advanced",
            "notes": "\n".join(notes),
            "audience": "team",
            "format": "technical",
            "authorId": owner_id,
        }
    if target == WorkflowHandoff.Target.WORK_ITEM:
        issue_type = str(output.get("issueType") or "needs-more-evidence")
        kind = {
            "product-defect": WorkItem.Kind.ENGINEERING,
            "configuration-or-process": WorkItem.Kind.VERIFICATION,
            "needs-more-evidence": WorkItem.Kind.INVESTIGATION,
        }.get(issue_type, WorkItem.Kind.INVESTIGATION)
        facts = "\n".join(f"- {item}" for item in output.get("confirmedFacts", []))
        checks = "\n".join(f"- {item}" for item in output.get("recommendedChecks", []))
        return {
            "title": source_title,
            "description": f"{summary}\n\nConfirmed facts\n{facts}\n\nNext checks\n{checks}"[:6000],
            "kind": kind,
            "assigneeKey": owner_id,
            "assigneeId": None,
            "dueDate": None,
        }
    raise OpsPilotError(
        code="INVALID_HANDOFF_TARGET",
        message="Choose a supported workflow handoff.",
        status=422,
    )
