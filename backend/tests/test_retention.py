from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from accounts.models import AppUser
from cases.models import OperationsCase
from cases.services import create_case
from runs.models import WorkflowRun

pytestmark = pytest.mark.django_db


def test_expired_runs_are_hidden_and_daily_command_purges_them(
    authenticated_client: Client,
) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    active = WorkflowRun.objects.create(
        user=user,
        workflow_id="bug-triage",
        input_json={},
        expires_at=timezone.now() + timedelta(days=1),
    )
    expired = WorkflowRun.objects.create(
        user=user,
        workflow_id="status-update",
        input_json={},
        expires_at=timezone.now() - timedelta(seconds=1),
    )

    history = authenticated_client.get("/api/v1/runs")
    detail = authenticated_client.get(f"/api/v1/runs/{expired.id}")
    output = StringIO()
    call_command("purge_expired_runs", stdout=output)

    assert [item["id"] for item in history.json()["items"]] == [str(active.id)]
    assert detail.status_code == 404
    assert "Purged 1 expired workflow run(s)." in output.getvalue()
    assert WorkflowRun.objects.filter(id=active.id).exists()
    assert not WorkflowRun.objects.filter(id=expired.id).exists()


def test_case_detail_hides_expired_linked_run_metadata(authenticated_client: Client) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    case = create_case(
        user=user,
        title="Retained case context",
        description="The case remains durable while expired workflow execution metadata is hidden.",
        summary="Retention boundary coverage.",
        disposition=OperationsCase.Disposition.UNCLASSIFIED,
        due_date=None,
        assignee_id=None,
    )
    active = WorkflowRun.objects.create(
        user=user,
        case=case,
        workflow_id="bug-triage",
        input_json={},
        expires_at=timezone.now() + timedelta(days=1),
    )
    expired = WorkflowRun.objects.create(
        user=user,
        case=case,
        workflow_id="status-update",
        input_json={},
        expires_at=timezone.now() - timedelta(seconds=1),
    )

    response = authenticated_client.get(f"/api/v1/cases/{case.id}")

    assert response.status_code == 200
    assert [run["id"] for run in response.json()["workflowRuns"]] == [str(active.id)]
    assert str(expired.id) not in {run["id"] for run in response.json()["workflowRuns"]}
