from uuid import UUID

from django.db.models import Count, Prefetch, Q, QuerySet
from django.utils import timezone

from accounts.models import AppUser
from cases.models import OperationsCase, WorkspaceMember
from common.errors import OpsPilotError
from runs.models import WorkflowRun


def cases_for_user(user: AppUser) -> QuerySet[OperationsCase]:
    return (
        OperationsCase.objects.filter(
            workspace__members__app_user=user,
            workspace__members__is_active=True,
        )
        .distinct()
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


def case_for_user(
    *,
    user: AppUser,
    case_id: UUID,
    detail: bool = False,
    for_update: bool = False,
) -> OperationsCase:
    queryset = OperationsCase.objects.filter(
        workspace__members__app_user=user,
        workspace__members__is_active=True,
        id=case_id,
    ).select_related(
        "workspace",
        "created_by",
        "assignment__assignee",
        "published_assessment",
    )
    if for_update:
        queryset = queryset.select_for_update()
    if detail:
        queryset = queryset.prefetch_related(
            "events__actor",
            "evidence",
            "assessments",
            "updates__author_member",
            "updates__attachments",
            "updates__task",
            Prefetch(
                "workflow_runs",
                queryset=WorkflowRun.objects.filter(
                    Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())
                ).order_by("-created_at", "-id"),
                to_attr="visible_workflow_runs",
            ),
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
    member = (
        WorkspaceMember.objects.filter(
            workspace__members__app_user=user,
            workspace__members__is_active=True,
            id=member_id,
            is_active=True,
        )
        .distinct()
        .first()
    )
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
    return (
        WorkspaceMember.objects.filter(
            workspace__members__app_user=user,
            workspace__members__is_active=True,
            key=key,
            is_active=True,
        )
        .distinct()
        .first()
    )


def acting_member(*, user: AppUser, workspace_id: UUID) -> WorkspaceMember:
    member = WorkspaceMember.objects.filter(
        workspace_id=workspace_id,
        app_user=user,
        is_active=True,
    ).first()
    if member is None:
        raise OpsPilotError(
            code="WORKSPACE_ACCESS_DENIED",
            message="Your account is not an active member of this workspace.",
            status=403,
        )
    return member


def require_case_manager(*, user: AppUser, case: OperationsCase) -> WorkspaceMember:
    member = acting_member(user=user, workspace_id=case.workspace_id)
    if member.access_role not in {
        WorkspaceMember.AccessRole.OWNER,
        WorkspaceMember.AccessRole.OPERATOR,
    }:
        raise OpsPilotError(
            code="CASE_MANAGER_REQUIRED",
            message="Only workspace owners and operators can make this case change.",
            status=403,
        )
    return member
