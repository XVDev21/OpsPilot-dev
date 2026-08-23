import pytest
from django.test import Client

from accounts.models import AppUser
from cases.models import CaseEvent, OperationsCase, WorkspaceMember
from cases.selectors import member_for_key
from cases.services import assign_case, create_case, record_case_event

pytestmark = pytest.mark.django_db


def _authenticate(client: Client) -> AppUser:
    response = client.get("/api/v1/me")
    assert response.status_code == 200
    return AppUser.objects.get(workos_user_id="user_test_primary")


def test_personal_workspace_and_sample_members_are_persisted(
    authenticated_client: Client,
) -> None:
    user = _authenticate(authenticated_client)

    response = authenticated_client.get("/api/v1/workspace/members")

    assert response.status_code == 200
    members = response.json()["items"]
    assert len(members) == 6
    assert sum(member["isSample"] for member in members) == 5
    assert any(member["linkedAccount"] and not member["isSample"] for member in members)
    assert {member["key"] for member in members if member["isSample"]} == {
        "sample-amelia-cruz",
        "sample-kai-mercer",
        "sample-theo-bennett",
        "sample-mina-park",
        "sample-rafael-silva",
    }
    assert user.personal_workspace.members.count() == 6


def test_case_lifecycle_assignment_filters_and_timeline(authenticated_client: Client) -> None:
    user = _authenticate(authenticated_client)
    kai = WorkspaceMember.objects.get(workspace__owner=user, key="sample-kai-mercer")
    mina = WorkspaceMember.objects.get(workspace__owner=user, key="sample-mina-park")
    created = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Holiday field is missing",
            "description": (
                "A payroll consultant cannot see the Holiday field while reviewing a client run."
            ),
            "summary": "Verify whether the payroll Holiday setting is disabled.",
            "disposition": "configuration-change",
            "dueDate": "2026-08-31",
            "assigneeId": str(kai.id),
        },
        content_type="application/json",
    )

    assert created.status_code == 201
    body = created.json()
    assert body["key"] == "OPS-0001"
    assert body["assignee"]["id"] == str(kai.id)
    assert [event["type"] for event in body["events"]] == [
        "assignment-changed",
        "created",
    ]

    invalid = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "in-progress"},
        content_type="application/json",
    )
    assert invalid.status_code == 409
    assert invalid.json()["error"]["code"] == "INVALID_CASE_TRANSITION"

    triaging = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "triaging", "confidence": 0.82},
        content_type="application/json",
    )
    assert triaging.status_code == 200
    in_progress = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "in-progress"},
        content_type="application/json",
    )
    assert in_progress.status_code == 200

    reassigned = authenticated_client.put(
        f"/api/v1/cases/{body['id']}/assignment",
        data={"assigneeId": str(mina.id)},
        content_type="application/json",
    )
    assert reassigned.status_code == 200
    assert reassigned.json()["assignee"]["key"] == "sample-mina-park"

    listed = authenticated_client.get(
        "/api/v1/cases",
        {"assigneeId": str(mina.id), "status": "in-progress", "search": "Holiday"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == body["id"]
    assert CaseEvent.objects.filter(case_id=body["id"], event_type="status-changed").count() == 2

    enriched = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={
            "disposition": "process-guidance",
            "confidence": None,
            "dueDate": None,
            "resolutionSummary": "Verified the supported payroll configuration path.",
        },
        content_type="application/json",
    )
    assert enriched.status_code == 200
    assert enriched.json()["dueDate"] is None
    assert enriched.json()["confidence"] is None
    assert enriched.json()["resolutionSummary"].startswith("Verified")

    resolved = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "resolved"},
        content_type="application/json",
    )
    assert resolved.status_code == 200
    assert resolved.json()["resolvedAt"] is not None
    closed = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "closed"},
        content_type="application/json",
    )
    assert closed.json()["resolvedAt"] is not None
    assert closed.json()["closedAt"] is not None
    reopened = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "triaging"},
        content_type="application/json",
    )
    assert reopened.json()["closedAt"] is None

    unassigned = assign_case(user=user, case_id=body["id"], assignee_id=None)
    event_count = CaseEvent.objects.filter(case=unassigned).count()
    assign_case(user=user, case_id=body["id"], assignee_id=None)
    assert unassigned.assignment.assignee is None
    assert CaseEvent.objects.filter(case=unassigned).count() == event_count
    record_case_event(case=unassigned, event_type=CaseEvent.Type.UPDATED, actor=None)
    detail = authenticated_client.get(f"/api/v1/cases/{body['id']}").json()
    assert detail["events"][0]["actorName"] == "OpsPilot"
    assert member_for_key(user=user, key="") is None
    assert member_for_key(user=user, key="sample-mina-park") == mina


def test_case_pagination_and_workspace_authorization(authenticated_client: Client) -> None:
    user = _authenticate(authenticated_client)
    for index in range(3):
        create_case(
            user=user,
            title=f"Delivery question {index}",
            description="The operations team needs a durable owner and a reviewed next action.",
            summary="Review and route this delivery question.",
            disposition=OperationsCase.Disposition.NEEDS_MORE_EVIDENCE,
            due_date=None,
            assignee_id=None,
        )
    page = authenticated_client.get("/api/v1/cases", {"page": 2, "pageSize": 1})
    assert page.status_code == 200
    assert page.json()["page"] == 2
    assert page.json()["total"] == 3
    assert page.json()["hasMore"] is True

    other = AppUser.objects.create(workos_user_id="other-case-user", email="other@example.com")
    foreign_member = other.personal_workspace.members.get(key="sample-mina-park")
    foreign_case = create_case(
        user=other,
        title="Private workspace case",
        description="This case belongs to a separate personal workspace and must stay private.",
        summary="Private case",
        disposition=OperationsCase.Disposition.UNCLASSIFIED,
        due_date=None,
        assignee_id=foreign_member.id,
    )

    assert authenticated_client.get(f"/api/v1/cases/{foreign_case.id}").status_code == 404
    rejected = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Invalid foreign assignment",
            "description": "A foreign workspace member cannot be assigned to this personal case.",
            "assigneeId": str(foreign_member.id),
        },
        content_type="application/json",
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "INVALID_ASSIGNEE"
