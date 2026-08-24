import pytest
from django.test import Client

from accounts.models import AppUser
from cases.models import CaseEvent, WorkspaceMember
from cases.services import create_case
from common.errors import OpsPilotError
from runs.models import WorkflowRun
from workitems.models import WorkflowHandoff, WorkItem
from workitems.services import create_work_item, update_work_item

pytestmark = pytest.mark.django_db


def _completed_bug_run(user: AppUser) -> WorkflowRun:
    return WorkflowRun.objects.create(
        user=user,
        workflow_id="bug-triage",
        status=WorkflowRun.Status.COMPLETED,
        execution_phase=WorkflowRun.ExecutionPhase.COMPLETED,
        input_json={"title": "CSV export stalls"},
        result_json={
            "summary": "Large exports stall while small exports complete.",
            "confirmedFacts": ["Small exports complete."],
            "evidenceGaps": ["Server logs were not supplied."],
            "recommendedChecks": ["Compare export job logs."],
            "issueType": "product-defect",
            "routing": {"ownerId": "sample-mina-park"},
        },
    )


def test_bug_triage_creates_distinct_reviewable_handoffs(authenticated_client: Client) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    assignee = WorkspaceMember.objects.get(workspace__owner=user, key="sample-mina-park")
    case = create_case(
        user=user,
        title="CSV export stalls",
        description="Large CSV exports remain in processing and require engineering review.",
        summary="Reproduce the scale-dependent export stall.",
        disposition="product-defect",
        due_date=None,
        assignee_id=assignee.id,
    )
    run = _completed_bug_run(user)
    run.case = case
    run.save(update_fields=["case"])

    work = authenticated_client.post(
        f"/api/v1/runs/{run.id}/handoffs",
        data={"target": "work-item"},
        content_type="application/json",
    )
    meeting = authenticated_client.post(
        f"/api/v1/runs/{run.id}/handoffs",
        data={"target": "meeting-actions"},
        content_type="application/json",
    )
    status = authenticated_client.post(
        f"/api/v1/runs/{run.id}/handoffs",
        data={"target": "status-update"},
        content_type="application/json",
    )

    assert [work.status_code, meeting.status_code, status.status_code] == [201, 201, 201]
    assert work.json()["draftInput"]["kind"] == "engineering"
    assert meeting.json()["draftInput"]["title"].startswith("Follow-up:")
    assert status.json()["draftInput"]["format"] == "technical"
    assert WorkflowHandoff.objects.count() == 3


def test_reviewed_work_item_is_persisted_and_handoff_converted(
    authenticated_client: Client,
) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    assignee = WorkspaceMember.objects.get(workspace__owner=user, key="sample-mina-park")
    case = create_case(
        user=user,
        title="CSV export stalls",
        description="Large CSV exports remain in processing and require engineering review.",
        summary="Reproduce the scale-dependent export stall.",
        disposition="product-defect",
        due_date=None,
        assignee_id=assignee.id,
    )
    run = _completed_bug_run(user)
    run.case = case
    run.save(update_fields=["case"])
    handoff = authenticated_client.post(
        f"/api/v1/runs/{run.id}/handoffs",
        data={"target": "work-item"},
        content_type="application/json",
    ).json()
    created = authenticated_client.post(
        "/api/v1/work-items",
        data={
            "handoffId": handoff["id"],
            "caseId": str(case.id),
            "title": "Fix large CSV export stalls",
            "description": "Reproduce the stall and compare job logs before implementing the fix.",
            "kind": "engineering",
            "assigneeId": str(assignee.id),
            "dueDate": "2026-08-30",
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    assert created.json()["sourceRunId"] == str(run.id)
    assert created.json()["caseId"] == str(case.id)
    assert created.json()["assigneeKey"] == "sample-mina-park"
    patched = authenticated_client.patch(
        f"/api/v1/work-items/{created.json()['id']}",
        data={"status": "in-progress", "dueDate": "2026-09-01"},
        content_type="application/json",
    )
    assert patched.status_code == 200
    assert patched.json()["status"] == "in-progress"
    assert patched.json()["dueDate"] == "2026-09-01"
    verifier = WorkspaceMember.objects.get(workspace__owner=user, key="sample-rafael-silva")
    reassigned = authenticated_client.patch(
        f"/api/v1/work-items/{created.json()['id']}",
        data={"assigneeId": str(verifier.id)},
        content_type="application/json",
    )
    assert reassigned.json()["assigneeKey"] == "sample-rafael-silva"
    completed = authenticated_client.patch(
        f"/api/v1/work-items/{created.json()['id']}",
        data={"status": "done", "assigneeId": None, "dueDate": None},
        content_type="application/json",
    )
    assert completed.json()["assigneeId"] is None
    assert completed.json()["dueDate"] is None
    filtered = authenticated_client.get(
        "/api/v1/work-items",
        {"status": "done", "caseId": str(case.id)},
    )
    assert [item["id"] for item in filtered.json()["items"]] == [created.json()["id"]]
    assert WorkflowHandoff.objects.get(id=handoff["id"]).status == "converted"
    assert CaseEvent.objects.filter(case=case, event_type="work-item-created").exists()
    assert CaseEvent.objects.filter(case=case, event_type="work-item-updated").exists()


def test_work_items_and_handoffs_are_user_scoped(authenticated_client: Client) -> None:
    authenticated_client.get("/api/v1/me")
    primary = AppUser.objects.get(workos_user_id="user_test_primary")
    other = AppUser.objects.create(workos_user_id="other-work-user")
    other_run = _completed_bug_run(other)
    other_handoff = WorkflowHandoff.objects.create(
        user=other,
        source_run=other_run,
        target="work-item",
        draft_input={"title": "private"},
    )
    other_item = WorkItem.objects.create(
        user=other,
        title="Other user's item",
        description="This private item must not be visible to another personal workspace.",
        kind="investigation",
    )
    assert primary != other
    assert authenticated_client.get(f"/api/v1/handoffs/{other_handoff.id}").status_code == 404
    listed = authenticated_client.get("/api/v1/work-items")
    assert listed.status_code == 200
    assert listed.json()["items"] == []
    standalone = authenticated_client.post(
        "/api/v1/work-items",
        data={
            "title": "Standalone follow-up",
            "description": "Keep supporting reviewed work that does not need an operations case.",
            "kind": "follow-up",
        },
        content_type="application/json",
    )
    assert standalone.status_code == 201
    assert standalone.json()["caseId"] is None
    assert (
        authenticated_client.patch(
            f"/api/v1/work-items/{other_item.id}",
            data={"status": "done"},
            content_type="application/json",
        ).status_code
        == 404
    )


def test_linked_assignee_can_update_task_state_but_not_reassign_it(
    authenticated_client: Client,
) -> None:
    authenticated_client.get("/api/v1/me")
    owner = AppUser.objects.get(workos_user_id="user_test_primary")
    member = WorkspaceMember.objects.get(workspace__owner=owner, key="sample-mina-park")
    contributor = AppUser.objects.create(
        workos_user_id="user_linked_contributor",
        email="contributor@example.com",
        display_name="Linked Contributor",
    )
    case = create_case(
        user=owner,
        title="Linked contributor delivery",
        description="A real linked workspace member owns the implementation task.",
        assignee_id=member.id,
    )
    member.app_user = contributor
    member.is_sample = False
    member.access_role = WorkspaceMember.AccessRole.CONTRIBUTOR
    member.save(update_fields=["app_user", "is_sample", "access_role"])
    task = create_work_item(
        user=owner,
        handoff_id=None,
        title="Verify payroll visibility",
        description="Confirm the supported field is visible for the payroll consultant role.",
        kind=WorkItem.Kind.VERIFICATION,
        assignee_id=member.id,
        case_id=case.id,
        due_date=None,
    )

    updated = update_work_item(
        user=contributor,
        item_id=task.id,
        status=WorkItem.Status.IN_PROGRESS,
    )
    assert updated.status == WorkItem.Status.IN_PROGRESS
    with pytest.raises(OpsPilotError) as rejected:
        update_work_item(
            user=contributor,
            item_id=task.id,
            assignee_id=None,
            assignee_supplied=True,
        )
    assert rejected.value.code == "CASE_TASK_MANAGER_REQUIRED"
    member.app_user = None
    member.save(update_fields=["app_user"])
    with pytest.raises(OpsPilotError) as removed_member:
        update_work_item(
            user=contributor,
            item_id=task.id,
            status=WorkItem.Status.DONE,
        )
    assert removed_member.value.code == "NOT_FOUND"
