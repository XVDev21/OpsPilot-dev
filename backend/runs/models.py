import uuid

from django.core.validators import MinValueValidator
from django.db import models

from accounts.models import AppUser


class WorkflowRun(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending", "Pending"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(AppUser, on_delete=models.CASCADE, related_name="workflow_runs")
    workflow_id = models.CharField(max_length=64)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING)
    input_json = models.JSONField(default=dict)
    result_json = models.JSONField(blank=True, null=True)
    error_code = models.CharField(max_length=64, blank=True, null=True)
    provider = models.CharField(max_length=64, blank=True, null=True)
    model = models.CharField(max_length=128, blank=True, null=True)
    prompt_version = models.CharField(max_length=32, blank=True, null=True)
    duration_ms = models.PositiveIntegerField(
        blank=True,
        null=True,
        validators=[MinValueValidator(0)],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "workflow_runs"
        ordering = ["-created_at", "-id"]
        indexes = [
            models.Index(fields=["user", "-created_at"], name="runs_user_created_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.workflow_id}:{self.id}"
