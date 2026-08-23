from django.db import migrations

SAMPLE_TEAM_MEMBERS = (
    ("sample-amelia-cruz", "Amelia Cruz", "amelia.cruz@example.invalid", "AC", "Operations lead", "Operations", "Owns intake quality, meeting follow-through, and delivery visibility.", "Available", ["Meeting follow-up", "Status coordination"], "indigo"),
    ("sample-kai-mercer", "Kai Mercer", "kai.mercer@example.invalid", "KM", "Support operations", "Operations", "Checks configuration, permissions, and reproducible user-side conditions before escalation.", "Available", ["Issue intake", "Settings review"], "cyan"),
    ("sample-theo-bennett", "Theo Bennett", "theo.bennett@example.invalid", "TB", "Development consultant", "Engineering", "Turns validated symptoms into a bounded technical investigation and implementation brief.", "Reviewing", ["Technical triage", "Scope review"], "amber"),
    ("sample-mina-park", "Mina Park", "mina.park@example.invalid", "MP", "Software engineer", "Engineering", "Owns code changes after the issue has enough evidence and an agreed reproduction path.", "Focused", ["Bug fixing", "Work updates"], "indigo"),
    ("sample-rafael-silva", "Rafael Silva", "rafael.silva@example.invalid", "RS", "Quality engineer", "Quality", "Builds minimal reproductions, verifies fixes, and records confidence-changing evidence.", "Available", ["Reproduction", "Release verification"], "cyan"),
)


def seed_personal_workspaces(apps, schema_editor):
    AppUser = apps.get_model("accounts", "AppUser")
    Workspace = apps.get_model("cases", "Workspace")
    WorkspaceMember = apps.get_model("cases", "WorkspaceMember")
    for user in AppUser.objects.iterator():
        workspace, _ = Workspace.objects.get_or_create(
            owner_id=user.id,
            defaults={"name": "Personal workspace"},
        )
        display_name = user.display_name or user.email or "Workspace owner"
        initials = "".join(part[0] for part in display_name.split()[:2]).upper() or "WO"
        WorkspaceMember.objects.update_or_create(
            workspace_id=workspace.id,
            app_user_id=user.id,
            defaults={
                "key": "workspace-owner",
                "name": display_name[:120],
                "email": user.email,
                "initials": initials[:4],
                "role": "Workspace owner",
                "discipline": "Operations",
                "focus": "Owns this personal workspace and approves case routing decisions.",
                "availability": "Available",
                "workflow_fit": ["Case ownership", "Final review"],
                "tone": "neutral",
                "is_sample": False,
                "is_active": True,
            },
        )
        for key, name, email, initials, role, discipline, focus, availability, fit, tone in SAMPLE_TEAM_MEMBERS:
            WorkspaceMember.objects.update_or_create(
                workspace_id=workspace.id,
                key=key,
                defaults={
                    "app_user_id": None,
                    "name": name,
                    "email": email,
                    "initials": initials,
                    "role": role,
                    "discipline": discipline,
                    "focus": focus,
                    "availability": availability,
                    "workflow_fit": fit,
                    "tone": tone,
                    "is_sample": True,
                    "is_active": True,
                },
            )


class Migration(migrations.Migration):
    dependencies = [("cases", "0001_initial")]

    operations = [
        migrations.RunPython(seed_personal_workspaces, migrations.RunPython.noop),
    ]
