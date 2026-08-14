from uuid import UUID

from django.db.models import Q, QuerySet
from django.utils import timezone

from accounts.models import AppUser
from common.errors import OpsPilotError
from runs.models import WorkflowRun


def runs_for_user(user: AppUser) -> QuerySet[WorkflowRun]:
    return (
        WorkflowRun.objects.filter(user=user)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
        .order_by("-created_at", "-id")
    )


def run_for_user(*, user: AppUser, run_id: UUID) -> WorkflowRun:
    run = (
        WorkflowRun.objects.filter(user=user, id=run_id)
        .filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now()))
        .first()
    )
    if run is None:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="The requested workflow run was not found.",
            status=404,
        )
    return run
