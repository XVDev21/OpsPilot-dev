from uuid import UUID

from django.db.models import Count, Q, QuerySet

from accounts.models import AppUser
from cases.models import OperationsCase, WorkspaceMember
from common.errors import OpsPilotError


def cases_for_user(user: AppUser) -> QuerySet[OperationsCase]:
    return (
        OperationsCase.objects.filter(workspace__owner=user)
        .select_related("assignment__assignee")
        .annotate(
            work_item_count=Count("work_items", distinct=True),
            completed_work_item_count=Count(
                "work_items",
                filter=Q(work_items__status="done"),
                distinct=True,
            ),
        )
        .order_by("-updated_at", "-number")
    )


def case_for_user(*, user: AppUser, case_id: UUID, detail: bool = False) -> OperationsCase:
    queryset = OperationsCase.objects.filter(workspace__owner=user, id=case_id).select_related(
        "workspace",
        "created_by",
        "assignment__assignee",
    )
    if detail:
        queryset = queryset.prefetch_related(
            "events__actor",
            "workflow_runs",
            "work_items__assignee",
        )
    case = queryset.first()
    if case is None:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That operations case was not found.",
            status=404,
        )
    return case


def member_for_user(*, user: AppUser, member_id: UUID) -> WorkspaceMember:
    member = WorkspaceMember.objects.filter(
        workspace__owner=user,
        id=member_id,
        is_active=True,
    ).first()
    if member is None:
        raise OpsPilotError(
            code="INVALID_ASSIGNEE",
            message="Choose an active member from this workspace.",
            status=422,
        )
    return member


def member_for_key(*, user: AppUser, key: str) -> WorkspaceMember | None:
    if not key:
        return None
    return WorkspaceMember.objects.filter(
        workspace__owner=user,
        key=key,
        is_active=True,
    ).first()
