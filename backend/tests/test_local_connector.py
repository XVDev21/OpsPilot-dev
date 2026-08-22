import hashlib
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from integrations.models import LocalConnector
from runs.models import LocalConnectorJob, WorkflowRun
from tests.test_workflow_execution import VALID_INPUTS, VALID_OUTPUTS

pytestmark = pytest.mark.django_db


def _pair(authenticated_client: Client) -> tuple[str, str]:
    pairing = authenticated_client.post(
        "/api/v1/local-connector/pairing",
        data={
            "name": "Studio workstation",
            "modelFast": "qwen2.5:3b",
            "modelBalanced": "qwen2.5:7b",
            "modelHigh": "qwen2.5:14b",
        },
        content_type="application/json",
    )
    assert pairing.status_code == 201
    body = pairing.json()
    redemption = authenticated_client.post(
        "/api/v1/connectors/pair",
        data={"connectorId": body["connector"]["id"], "pairingCode": body["pairingCode"]},
        content_type="application/json",
    )
    assert redemption.status_code == 200
    return body["connector"]["id"], redemption.json()["connectorToken"]


def test_pairing_secrets_are_one_time_and_hashed(authenticated_client: Client) -> None:
    pairing = authenticated_client.post(
        "/api/v1/local-connector/pairing",
        data={
            "name": "Private inference",
            "modelFast": "local-small",
            "modelBalanced": "local-medium",
            "modelHigh": "local-large",
        },
        content_type="application/json",
    ).json()
    connector = LocalConnector.objects.get(id=pairing["connector"]["id"])
    assert (
        connector.pairing_code_digest
        == hashlib.sha256(pairing["pairingCode"].encode("utf-8")).hexdigest()
    )
    assert pairing["pairingCode"] not in connector.pairing_code_digest

    first = authenticated_client.post(
        "/api/v1/connectors/pair",
        data={"connectorId": str(connector.id), "pairingCode": pairing["pairingCode"]},
        content_type="application/json",
    )
    second = authenticated_client.post(
        "/api/v1/connectors/pair",
        data={"connectorId": str(connector.id), "pairingCode": pairing["pairingCode"]},
        content_type="application/json",
    )
    connector.refresh_from_db()
    assert first.status_code == 200
    assert second.status_code == 401
    assert first.json()["connectorToken"] not in connector.token_digest


def test_local_run_is_queued_claimed_and_completed(authenticated_client: Client) -> None:
    connector_id, token = _pair(authenticated_client)
    run_response = authenticated_client.post(
        "/api/v1/workflows/bug-triage/runs",
        data={
            "input": VALID_INPUTS["bug-triage"],
            "options": {"provider": "local", "intelligence": "balanced"},
        },
        content_type="application/json",
    )
    assert run_response.status_code == 202
    assert run_response.json()["execution_phase"] == "queued"

    claim = authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/claim",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert claim.status_code == 200
    assert claim.json()["workflowId"] == "bug-triage"
    assert claim.json()["model"] == "qwen2.5:7b"

    complete = authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/jobs/{run_response.json()['id']}",
        data={
            "output": VALID_OUTPUTS["BugTriageOutput"],
            "inputTokens": 29,
            "outputTokens": 17,
        },
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert complete.status_code == 200
    assert complete.json()["status"] == "completed"
    assert complete.json()["execution_phase"] == "completed"
    assert LocalConnectorJob.objects.get().status == LocalConnectorJob.Status.COMPLETED


def test_connector_rejects_wrong_token_and_keeps_invalid_output_failure(
    authenticated_client: Client,
) -> None:
    connector_id, token = _pair(authenticated_client)
    denied = authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/claim",
        HTTP_AUTHORIZATION="Bearer wrong-token",
    )
    assert denied.status_code == 401

    run_response = authenticated_client.post(
        "/api/v1/workflows/status-update/runs",
        data={
            "input": VALID_INPUTS["status-update"],
            "options": {"provider": "local", "intelligence": "fast"},
        },
        content_type="application/json",
    )
    authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/claim",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    failed = authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/jobs/{run_response.json()['id']}",
        data={"output": {"not": "the contract"}},
        content_type="application/json",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    assert failed.status_code == 200
    assert failed.json()["status"] == "failed"
    assert failed.json()["error_code"] == "INVALID_AI_OUTPUT"
    assert WorkflowRun.objects.get(id=run_response.json()["id"]).status == "failed"


def test_disconnect_fails_pending_jobs(authenticated_client: Client) -> None:
    connector_id, _ = _pair(authenticated_client)
    run_response = authenticated_client.post(
        "/api/v1/workflows/status-update/runs",
        data={
            "input": VALID_INPUTS["status-update"],
            "options": {"provider": "local", "intelligence": "fast"},
        },
        content_type="application/json",
    )
    removed = authenticated_client.delete(f"/api/v1/local-connector/{connector_id}")
    run = WorkflowRun.objects.get(id=run_response.json()["id"])
    assert removed.status_code == 204
    assert run.status == "failed"
    assert run.error_code == "LOCAL_CONNECTOR_DISCONNECTED"


def test_exhausted_connector_job_fails_instead_of_hanging(
    authenticated_client: Client,
) -> None:
    connector_id, token = _pair(authenticated_client)
    run_response = authenticated_client.post(
        "/api/v1/workflows/status-update/runs",
        data={
            "input": VALID_INPUTS["status-update"],
            "options": {"provider": "local", "intelligence": "fast"},
        },
        content_type="application/json",
    )
    authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/claim",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    LocalConnectorJob.objects.filter(run_id=run_response.json()["id"]).update(
        attempts=3,
        lease_expires_at=timezone.now() - timedelta(seconds=1),
    )

    next_claim = authenticated_client.post(
        f"/api/v1/connectors/{connector_id}/claim",
        HTTP_AUTHORIZATION=f"Bearer {token}",
    )
    run = WorkflowRun.objects.get(id=run_response.json()["id"])

    assert next_claim.status_code == 204
    assert run.status == WorkflowRun.Status.FAILED
    assert run.error_code == "LOCAL_CONNECTOR_UNAVAILABLE"
