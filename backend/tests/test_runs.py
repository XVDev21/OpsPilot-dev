from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from accounts.models import AppUser
from runs.models import WorkflowRun

pytestmark = pytest.mark.django_db


def make_run(user: AppUser, *, workflow_id: str = "bug-triage") -> WorkflowRun:
    return WorkflowRun.objects.create(
        user=user,
        workflow_id=workflow_id,
        status=WorkflowRun.Status.COMPLETED,
        input_json={"title": "CSV export stalls"},
        result_json={"summary": "Review export processing logs."},
        provider="gemini",
        model="gemini-test",
        duration_ms=842,
        completed_at=timezone.now(),
    )


def test_history_is_user_scoped_and_newest_first(authenticated_client: Client) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    older = make_run(user)
    WorkflowRun.objects.filter(id=older.id).update(created_at=timezone.now() - timedelta(days=1))
    newer = make_run(user, workflow_id="status-update")
    other_user = AppUser.objects.create(workos_user_id="user_other")
    make_run(other_user)

    response = authenticated_client.get("/api/v1/runs")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["items"]] == [str(newer.id), str(older.id)]
    assert response.json()["next_cursor"] is None


def test_history_paginates_twenty_runs(authenticated_client: Client) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    WorkflowRun.objects.bulk_create(
        [
            WorkflowRun(user=user, workflow_id="bug-triage", input_json={"index": index})
            for index in range(21)
        ]
    )

    first_page = authenticated_client.get("/api/v1/runs")
    second_page = authenticated_client.get("/api/v1/runs", {"page": 2})

    assert len(first_page.json()["items"]) == 20
    assert first_page.json()["next_cursor"] == "2"
    assert len(second_page.json()["items"]) == 1
    assert second_page.json()["next_cursor"] is None


def test_run_detail_and_delete_enforce_ownership(authenticated_client: Client) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    owned = make_run(user)
    other_user = AppUser.objects.create(workos_user_id="user_other")
    other = make_run(other_user)

    detail = authenticated_client.get(f"/api/v1/runs/{owned.id}")
    hidden = authenticated_client.get(f"/api/v1/runs/{other.id}")
    hidden_delete = authenticated_client.delete(f"/api/v1/runs/{other.id}")
    deleted = authenticated_client.delete(f"/api/v1/runs/{owned.id}")

    assert detail.status_code == 200
    assert detail.json()["id"] == str(owned.id)
    assert hidden.status_code == 404
    assert hidden.json()["error"]["code"] == "NOT_FOUND"
    assert hidden_delete.status_code == 404
    assert deleted.status_code == 204
    assert not WorkflowRun.objects.filter(id=owned.id).exists()
