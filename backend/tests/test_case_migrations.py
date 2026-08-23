import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

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

        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        current_apps = executor.loader.project_state(executor.loader.graph.leaf_nodes()).apps
        MigratedWorkItem = current_apps.get_model("workitems", "WorkItem")
        migrated = MigratedWorkItem.objects.select_related("assignee").get(id=item.id)

        assert migrated.assignee.key == "sample-mina-park"
        assert migrated.assignee.name == "Mina Park"
        assert migrated.assignee.workspace.owner_id == user.id
    finally:
        MigrationExecutor(connection).migrate(current_targets)
