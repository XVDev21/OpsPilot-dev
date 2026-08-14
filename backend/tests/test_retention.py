from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.test import Client
from django.utils import timezone

from accounts.models import AppUser
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
