from cases.models import OperationsCase, WorkspaceMember


def member_dict(member: WorkspaceMember | None) -> dict | None:
    if member is None:
        return None
    return {
        "id": member.id,
        "key": member.key,
        "name": member.name,
        "email": member.email,
        "initials": member.initials,
        "role": member.role,
        "discipline": member.discipline,
        "focus": member.focus,
        "availability": member.availability,
        "workflowFit": member.workflow_fit,
        "tone": member.tone,
        "isSample": member.is_sample,
        "linkedAccount": member.app_user_id is not None,
    }


def case_assignee(case: OperationsCase) -> WorkspaceMember | None:
    assignment = getattr(case, "assignment", None)
    return assignment.assignee if assignment else None


def case_summary_dict(case: OperationsCase) -> dict:
    work_item_count = getattr(case, "work_item_count", None)
    if work_item_count is None:
        work_item_count = case.work_items.count()
    completed_work_item_count = getattr(case, "completed_work_item_count", None)
    if completed_work_item_count is None:
        completed_work_item_count = case.work_items.filter(status="done").count()
    return {
        "id": case.id,
        "key": case.key,
        "title": case.title,
        "summary": case.summary,
        "status": case.status,
        "disposition": case.disposition,
        "confidence": case.confidence,
        "dueDate": case.due_date,
        "assignee": member_dict(case_assignee(case)),
        "workItemCount": work_item_count,
        "completedWorkItemCount": completed_work_item_count,
        "createdAt": case.created_at,
        "updatedAt": case.updated_at,
    }


def work_item_dict(item) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "kind": item.kind,
        "status": item.status,
        "assignee": member_dict(item.assignee),
        "dueDate": item.due_date,
        "sourceRunId": item.source_run_id,
        "sourceHandoffId": item.source_handoff_id,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


def case_detail_dict(case: OperationsCase) -> dict:
    data = case_summary_dict(case)
    data.update(
        {
            "description": case.description,
            "resolutionSummary": case.resolution_summary,
            "resolvedAt": case.resolved_at,
            "closedAt": case.closed_at,
            "workflowRuns": [
                {
                    "id": run.id,
                    "workflowId": run.workflow_id,
                    "status": run.status,
                    "executionPhase": run.execution_phase,
                    "createdAt": run.created_at,
                    "completedAt": run.completed_at,
                }
                for run in case.workflow_runs.all()
            ],
            "workItems": [work_item_dict(item) for item in case.work_items.all()],
            "events": [
                {
                    "id": event.id,
                    "type": event.event_type,
                    "actorName": _event_actor_name(event),
                    "payload": event.payload,
                    "createdAt": event.created_at,
                }
                for event in case.events.all()
            ],
        }
    )
    return data


def _event_actor_name(event) -> str:
    if event.actor is None:
        return "OpsPilot"
    return event.actor.display_name or event.actor.email or "Workspace owner"
