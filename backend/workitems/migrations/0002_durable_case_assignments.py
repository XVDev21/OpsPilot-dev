import django.db.models.deletion
from django.db import migrations, models


def migrate_assignees(apps, schema_editor):
    Workspace = apps.get_model("cases", "Workspace")
    WorkspaceMember = apps.get_model("cases", "WorkspaceMember")
    WorkItem = apps.get_model("workitems", "WorkItem")
    workspace_ids = dict(Workspace.objects.values_list("owner_id", "id"))
    for item in WorkItem.objects.exclude(legacy_assignee_id="").iterator():
        workspace_id = workspace_ids.get(item.user_id)
        if workspace_id is None:
            continue
        legacy_key = item.legacy_assignee_id[:64]
        member = WorkspaceMember.objects.filter(
            workspace_id=workspace_id,
            key=legacy_key,
        ).first()
        if member is None:
            readable_name = legacy_key.replace("-", " ").strip().title() or "Imported member"
            member = WorkspaceMember.objects.create(
                workspace_id=workspace_id,
                key=legacy_key,
                name=readable_name[:120],
                initials="IM",
                role="Imported collaborator",
                discipline="Operations",
                focus="Preserved from an earlier work-item assignment.",
                availability="Unknown",
                workflow_fit=[],
                tone="neutral",
                is_sample=False,
                is_active=True,
            )
        item.assignee_id = member.id
        item.save(update_fields=["assignee"])


class Migration(migrations.Migration):
    dependencies = [
        ("cases", "0002_seed_personal_workspaces"),
        ("workitems", "0001_initial"),
    ]

    operations = [
        migrations.RenameField(
            model_name="workitem",
            old_name="assignee_id",
            new_name="legacy_assignee_id",
        ),
        migrations.AddField(
            model_name="workflowhandoff",
            name="case",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="handoffs",
                to="cases.operationscase",
            ),
        ),
        migrations.AddField(
            model_name="workitem",
            name="assignee",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="work_items",
                to="cases.workspacemember",
            ),
        ),
        migrations.AddField(
            model_name="workitem",
            name="case",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="work_items",
                to="cases.operationscase",
            ),
        ),
        migrations.RunPython(migrate_assignees, migrations.RunPython.noop),
        migrations.RemoveField(model_name="workitem", name="legacy_assignee_id"),
        migrations.AddIndex(
            model_name="workitem",
            index=models.Index(
                fields=["case", "status", "-updated_at"],
                name="work_items_case_status_idx",
            ),
        ),
    ]
