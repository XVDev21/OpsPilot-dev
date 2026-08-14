from django.contrib import admin

from runs.models import WorkflowRun


@admin.register(WorkflowRun)
class WorkflowRunAdmin(admin.ModelAdmin):
    list_display = ("id", "workflow_id", "status", "user", "created_at")
    list_filter = ("workflow_id", "status")
    search_fields = ("id", "user__workos_user_id", "user__email")
    readonly_fields = ("id", "created_at", "completed_at")
