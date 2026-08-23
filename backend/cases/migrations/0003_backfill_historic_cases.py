from django.db import migrations
from django.db.models import Q
from django.utils import timezone


def disposition_for(result):
    issue_type = result.get("issueType") if isinstance(result, dict) else None
    return {
        "product-defect": "product-defect",
        "configuration-or-process": "configuration-change",
        "needs-more-evidence": "needs-more-evidence",
    }.get(issue_type, "unclassified")


def confidence_for(result):
    value = result.get("confidence") if isinstance(result, dict) else None
    if isinstance(value, (int, float)):
        return max(0, min(1, float(value)))
    return None


def backfill_historic_cases(apps, schema_editor):
    Workspace = apps.get_model("cases", "Workspace")
    WorkspaceMember = apps.get_model("cases", "WorkspaceMember")
    OperationsCase = apps.get_model("cases", "OperationsCase")
    CaseAssignment = apps.get_model("cases", "CaseAssignment")
    CaseEvent = apps.get_model("cases", "CaseEvent")
    WorkflowRun = apps.get_model("runs", "WorkflowRun")
    WorkflowHandoff = apps.get_model("workitems", "WorkflowHandoff")
    WorkItem = apps.get_model("workitems", "WorkItem")

    migration_time = timezone.now()
    for workspace in Workspace.objects.iterator():
        next_number = (
            OperationsCase.objects.filter(workspace_id=workspace.id)
            .order_by("-number")
            .values_list("number", flat=True)
            .first()
            or 0
        )
        runs = WorkflowRun.objects.filter(
            user_id=workspace.owner_id,
            workflow_id="bug-triage",
            case_id__isnull=True,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=migration_time))
        runs = runs.order_by("created_at", "id")
        for run in runs.iterator():
            next_number += 1
            source_input = run.input_json if isinstance(run.input_json, dict) else {}
            result = run.result_json if isinstance(run.result_json, dict) else {}
            status = {
                "pending": "triaging",
                "completed": "action-required",
                "failed": "needs-information",
            }.get(run.status, "new")
            title = str(source_input.get("title") or "Imported Bug Triage")[:200]
            description = str(
                source_input.get("observedBehavior")
                or result.get("summary")
                or "Imported from an earlier Bug Triage run."
            )[:6000]
            case = OperationsCase.objects.create(
                workspace_id=workspace.id,
                number=next_number,
                title=title,
                description=description,
                summary=str(result.get("summary") or "")[:3000],
                status=status,
                disposition=disposition_for(result),
                confidence=confidence_for(result),
                created_by_id=workspace.owner_id,
            )
            source_updated_at = run.completed_at or run.created_at
            OperationsCase.objects.filter(id=case.id).update(
                created_at=run.created_at,
                updated_at=source_updated_at,
            )
            event = CaseEvent.objects.create(
                case_id=case.id,
                actor_id=None,
                event_type="created",
                payload={"source": "historic-backfill", "runId": str(run.id)},
            )
            CaseEvent.objects.filter(id=event.id).update(created_at=run.created_at)
            run.case_id = case.id
            run.save(update_fields=["case"])
            handoff_ids = list(
                WorkflowHandoff.objects.filter(
                    user_id=workspace.owner_id,
                    source_run_id=run.id,
                ).values_list("id", flat=True)
            )
            WorkflowHandoff.objects.filter(
                user_id=workspace.owner_id,
                id__in=handoff_ids,
            ).update(case_id=case.id)
            WorkItem.objects.filter(
                user_id=workspace.owner_id,
                source_run_id=run.id,
            ).update(case_id=case.id)
            WorkItem.objects.filter(
                user_id=workspace.owner_id,
                source_handoff_id__in=handoff_ids,
            ).update(case_id=case.id)
            target_run_ids = WorkflowHandoff.objects.filter(
                user_id=workspace.owner_id,
                id__in=handoff_ids,
                target_run_id__isnull=False,
            ).values_list("target_run_id", flat=True)
            WorkflowRun.objects.filter(
                user_id=workspace.owner_id,
                id__in=target_run_ids,
                case_id__isnull=True,
            ).update(case_id=case.id)
            routing = result.get("routing")
            owner_key = routing.get("ownerId") if isinstance(routing, dict) else None
            if isinstance(owner_key, str) and owner_key:
                member = WorkspaceMember.objects.filter(
                    workspace_id=workspace.id,
                    key=owner_key,
                ).first()
                if member:
                    CaseAssignment.objects.create(
                        case_id=case.id,
                        assignee_id=member.id,
                        assigned_by_id=workspace.owner_id,
                    )


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0002_seed_personal_workspaces"),
        ("runs", "0005_workflowrun_case"),
        ("workitems", "0002_durable_case_assignments"),
    ]

    operations = [
        migrations.RunPython(backfill_historic_cases, migrations.RunPython.noop),
    ]
