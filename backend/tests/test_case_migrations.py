from datetime import timedelta

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.utils import timezone

pytestmark = pytest.mark.django_db(transaction=True)


def test_legacy_work_item_assignee_is_preserved_as_workspace_member() -> None:
    executor = MigrationExecutor(connection)
    previous_targets = [
        ("runs", "0004_workflowrun_execution_phase_and_more"),
        ("workitems", "0001_initial"),
        ("cases", None),
    ]
    current_targets = executor.loader.graph.leaf_nodes()
    try:
        executor.migrate(previous_targets)
        previous_apps = executor.loader.project_state(previous_targets[:2]).apps
        AppUser = previous_apps.get_model("accounts", "AppUser")
        WorkflowRun = previous_apps.get_model("runs", "WorkflowRun")
        WorkItem = previous_apps.get_model("workitems", "WorkItem")
        user = AppUser.objects.create(
            workos_user_id="migration-preservation-user",
            email="migration@example.com",
        )
        item = WorkItem.objects.create(
            user=user,
            title="Preserve legacy ownership",
            description="This assignment key must survive the durable case migration.",
            kind="engineering",
            assignee_id="sample-mina-park",
        )
        source_time = timezone.now() - timedelta(days=2)
        active_run = WorkflowRun.objects.create(
            user_id=user.id,
            workflow_id="bug-triage",
            status="completed",
            input_json={
                "title": "Preserve this active run",
                "observedBehavior": "The active run should become a durable case.",
            },
            result_json={"summary": "Active retained summary."},
            expires_at=timezone.now() + timedelta(days=1),
        )
        WorkflowRun.objects.filter(id=active_run.id).update(
            created_at=source_time,
            completed_at=source_time + timedelta(minutes=2),
        )
        active_run.refresh_from_db()
        expired_run = WorkflowRun.objects.create(
            user_id=user.id,
            workflow_id="bug-triage",
            status="completed",
            input_json={"title": "Do not resurrect expired content"},
            result_json={"summary": "Expired private summary."},
            expires_at=timezone.now() - timedelta(seconds=1),
        )

        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        current_apps = executor.loader.project_state(executor.loader.graph.leaf_nodes()).apps
        MigratedWorkItem = current_apps.get_model("workitems", "WorkItem")
        OperationsCase = current_apps.get_model("cases", "OperationsCase")
        CaseEvent = current_apps.get_model("cases", "CaseEvent")
        MigratedRun = current_apps.get_model("runs", "WorkflowRun")
        migrated = MigratedWorkItem.objects.select_related("assignee").get(id=item.id)

        assert migrated.assignee.key == "sample-mina-park"
        assert migrated.assignee.name == "Mina Park"
        assert migrated.assignee.workspace.owner_id == user.id
        case = OperationsCase.objects.get(workflow_runs__id=active_run.id)
        event = CaseEvent.objects.get(case_id=case.id, event_type="created")
        assert case.title == "Preserve this active run"
        assert case.created_at == active_run.created_at
        assert event.actor_id is None
        assert event.created_at == active_run.created_at
        assert MigratedRun.objects.get(id=expired_run.id).case_id is None
        assert not OperationsCase.objects.filter(title="Do not resurrect expired content").exists()
    finally:
        MigrationExecutor(connection).migrate(current_targets)
