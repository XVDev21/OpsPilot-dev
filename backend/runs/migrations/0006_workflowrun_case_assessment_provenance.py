from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("runs", "0005_workflowrun_case"),
    ]

    operations = [
        migrations.AddField(
            model_name="workflowrun",
            name="is_case_assessment",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="workflowrun",
            name="case_evidence_snapshot",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
