import uuid

from django.db import models

from accounts.models import AppUser


class WorkflowHandoff(models.Model):
    class Target(models.TextChoices):
        WORK_ITEM = "work-item", "Work item"
        MEETING_ACTIONS = "meeting-actions", "Meeting actions"
        STATUS_UPDATE = "status-update", "Work status"

    class Status(models.TextChoices):
        DRAFT = "draft", "Draft"
        CONVERTED = "converted", "Converted"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name="workflow_handoffs")
    case = models.ForeignKey(
        "cases.OperationsCase",
        on_delete=models.SET_NULL,
        related_name="handoffs",
        blank=True,
        null=True,
    )
    source_run = models.ForeignKey(
        "runs.WorkflowRun",
        on_delete=models.CASCADE,
        related_name="outgoing_handoffs",
    )
    target = models.CharField(max_length=32, choices=Target.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT)
    draft_input = models.JSONField(default=dict)
    target_run = models.ForeignKey(
        "runs.WorkflowRun",
        on_delete=models.SET_NULL,
        related_name="incoming_handoff",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    converted_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "workflow_handoffs"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["user", "source_run", "target"],
                condition=models.Q(status="draft"),
                name="one_open_handoff_per_target",
            )
        ]


class WorkItem(models.Model):
    class Kind(models.TextChoices):
        ENGINEERING = "engineering", "Engineering defect"
        VERIFICATION = "verification", "Configuration verification"
        INVESTIGATION = "investigation", "Evidence investigation"
        FOLLOW_UP = "follow-up", "Meeting follow-up"

    class Status(models.TextChoices):
        TODO = "todo", "To do"
        IN_PROGRESS = "in-progress", "In progress"
        BLOCKED = "blocked", "Blocked"
        DONE = "done", "Done"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name="work_items")
    case = models.ForeignKey(
        "cases.OperationsCase",
        on_delete=models.SET_NULL,
        related_name="work_items",
        blank=True,
        null=True,
    )
    source_run = models.ForeignKey(
        "runs.WorkflowRun",
        on_delete=models.SET_NULL,
        related_name="work_items",
        blank=True,
        null=True,
    )
    source_handoff = models.OneToOneField(
        WorkflowHandoff,
        on_delete=models.SET_NULL,
        related_name="work_item",
        blank=True,
        null=True,
    )
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=6000)
    kind = models.CharField(max_length=24, choices=Kind.choices)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.TODO)
    assignee = models.ForeignKey(
        "cases.WorkspaceMember",
        on_delete=models.SET_NULL,
        related_name="work_items",
        blank=True,
        null=True,
    )
    due_date = models.DateField(blank=True, null=True)
    blocker_reason = models.TextField(max_length=2000, blank=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "work_items"
        ordering = ["-updated_at", "-created_at"]
        indexes = [
            models.Index(fields=["user", "status", "-updated_at"]),
            models.Index(
                fields=["case", "status", "-updated_at"],
                name="work_items_case_status_idx",
            ),
        ]


class CaseTask(WorkItem):
    """Case-first product name for the preserved WorkItem storage and lineage."""

    class Meta:
        proxy = True
        verbose_name = "case task"
        verbose_name_plural = "case tasks"
