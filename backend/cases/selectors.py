from uuid import UUID

from django.db.models import Count, Prefetch, Q, QuerySet
from django.utils import timezone

from accounts.models import AppUser
from cases.models import OperationsCase, Workspace, WorkspaceMember
from common.errors import OpsPilotError
from runs.models import WorkflowRun


def selected_workspace_for_user(user: AppUser) -> tuple[Workspace, WorkspaceMember]:
    selected_id = getattr(user, "_opspilot_workspace_id", None)
    memberships = WorkspaceMember.objects.filter(app_user=user, is_active=True).select_related(
        "workspace"
    )
    member = (
        memberships.filter(workspace_id=selected_id).first()
        if selected_id is not None
        else memberships.filter(workspace__owner=user).first()
    )
    if member is None:
        raise OpsPilotError(
            code="WORKSPACE_ACCESS_DENIED",
            message="Your account is not an active member of this workspace.",
            status=403,
        )
    workspace = member.workspace
    if (
        getattr(user, "_opspilot_auth_context", False)
        and not getattr(user, "_opspilot_organization_id", None)
        and workspace.collaboration_state == Workspace.CollaborationState.ACTIVE
    ):
        raise OpsPilotError(
            code="WORKSPACE_SELECTION_REQUIRED",
            message="Select this workspace again to refresh its organization session.",
            status=409,
        )
    return workspace, member


def _visible_cases(user: AppUser) -> QuerySet[OperationsCase]:
    if not getattr(user, "_opspilot_auth_context", False) and not getattr(
        user, "_opspilot_workspace_id", None
    ):
        active_memberships = WorkspaceMember.objects.filter(app_user=user, is_active=True)
        manager_workspace_ids = active_memberships.filter(
            access_role__in=[
                WorkspaceMember.AccessRole.OWNER,
                WorkspaceMember.AccessRole.OPERATOR,
            ]
        ).values("workspace_id")
        return (
            OperationsCase.objects.filter(
                workspace__members__in=active_memberships,
            )
            .filter(
                Q(workspace_id__in=manager_workspace_ids)
                | Q(publication_state=OperationsCase.PublicationState.PUBLISHED)
                | Q(created_by=user)
            )
            .distinct()
        )
    workspace, member = selected_workspace_for_user(user)
    queryset = OperationsCase.objects.filter(workspace=workspace)
    if member.access_role not in {
        WorkspaceMember.AccessRole.OWNER,
        WorkspaceMember.AccessRole.OPERATOR,
    }:
        queryset = queryset.filter(
            Q(publication_state=OperationsCase.PublicationState.PUBLISHED) | Q(created_by=user)
        )
    return queryset


def cases_for_user(user: AppUser) -> QuerySet[OperationsCase]:
    return (
        _visible_cases(user)
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
    queryset = (
        _visible_cases(user)
        .filter(id=case_id)
        .select_related(
            "workspace",
            "created_by",
            "assignment__assignee",
            "published_assessment",
        )
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
            "updates__mentions__member",
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
    workspace, _ = selected_workspace_for_user(user)
    member = WorkspaceMember.objects.filter(
        workspace=workspace,
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
    workspace, _ = selected_workspace_for_user(user)
    return WorkspaceMember.objects.filter(
        workspace=workspace,
        key=key,
        is_active=True,
    ).first()


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
