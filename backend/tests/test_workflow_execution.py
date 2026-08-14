from dataclasses import dataclass

import pytest
from django.test import Client, override_settings
from pydantic import BaseModel

from accounts.models import AppUser
from ai.types import ProviderFailure, ProviderResult
from runs.models import WorkflowRun

pytestmark = pytest.mark.django_db


VALID_INPUTS = {
    "bug-triage": {
        "title": "CSV export stalls",
        "affectedArea": "Reporting exports",
        "observedBehavior": "Large CSV exports remain in processing for more than ten minutes.",
        "expectedBehavior": "The export should complete and provide a downloadable CSV file.",
        "evidence": [{"value": "Small exports complete successfully."}],
    },
    "meeting-actions": {
        "title": "Release readiness review",
        "notes": (
            "The team decided to delay release until Monday. Mina will verify the migration by "
            "Friday. The analytics owner remains unresolved."
        ),
        "participants": [{"value": "Mina"}, {"value": "Dev team"}],
        "date": "2026-08-14",
    },
    "status-update": {
        "notes": (
            "Completed the export validation. The migration check is in progress. Release remains "
            "blocked on analytics ownership. Next, confirm the owner."
        ),
        "audience": "team",
        "format": "daily",
    },
}

VALID_OUTPUTS = {
    "BugTriageOutput": {
        "summary": "Large exports stall while small exports complete.",
        "confirmedFacts": ["Small exports complete."],
        "evidenceGaps": ["Server logs were not supplied."],
        "likelyCategory": "Scale-dependent export processing",
        "recommendedChecks": ["Compare small and large export job logs."],
        "confidence": 0.72,
        "humanReviewNotice": "An engineer must validate this triage.",
    },
    "MeetingActionsOutput": {
        "summary": "Release was delayed pending migration verification.",
        "decisions": ["Delay release until Monday."],
        "actionItems": [{"task": "Verify the migration.", "owner": "Mina", "deadline": "Friday"}],
        "openQuestions": ["Who owns analytics?"],
        "unresolvedItems": ["Analytics ownership"],
    },
    "StatusUpdateOutput": {
        "completed": ["Export validation"],
        "inProgress": ["Migration check"],
        "blocked": ["Release pending analytics ownership"],
        "nextSteps": ["Confirm the analytics owner"],
        "shareableUpdate": "Export validation is complete; migration checks continue.",
    },
}


@dataclass
class StubProvider:
    input_tokens: int = 101
    output_tokens: int = 53

    def generate_structured(self, *, output_schema: type[BaseModel], **kwargs) -> ProviderResult:
        assert "untrusted workflow data" in kwargs["system_instruction"]
        assert "validated JSON input" in kwargs["user_content"]
        return ProviderResult(
            output=output_schema.model_validate(VALID_OUTPUTS[output_schema.__name__]),
            input_tokens=self.input_tokens,
            output_tokens=self.output_tokens,
        )


@pytest.mark.parametrize("workflow_id", list(VALID_INPUTS))
def test_all_live_workflows_complete_and_persist(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
    workflow_id: str,
) -> None:
    monkeypatch.setattr("runs.services.get_provider", lambda provider: StubProvider())

    response = authenticated_client.post(
        f"/api/v1/workflows/{workflow_id}/runs",
        data={
            "input": VALID_INPUTS[workflow_id],
            "options": {"provider": "openai", "intelligence": "balanced"},
        },
        content_type="application/json",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["status"] == "completed"
    assert body["provider"] == "openai"
    assert body["intelligence"] == "balanced"
    assert body["prompt_version"] == "v2-provider-neutral"
    assert body["input_tokens"] == 101
    assert body["output_tokens"] == 53
    assert body["expires_at"] is not None
    run = WorkflowRun.objects.get(id=body["id"])
    assert run.result_json == body["result_json"]


def test_unknown_workflow_and_bad_input_do_not_call_provider(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "runs.services.get_provider",
        lambda provider: pytest.fail("provider should not be called"),
    )
    unknown = authenticated_client.post(
        "/api/v1/workflows/freeform/runs",
        data={"input": {}},
        content_type="application/json",
    )
    invalid = authenticated_client.post(
        "/api/v1/workflows/bug-triage/runs",
        data={"input": {"title": "No"}},
        content_type="application/json",
    )

    assert unknown.status_code == 404
    assert unknown.json()["error"]["code"] == "UNKNOWN_WORKFLOW"
    assert invalid.status_code == 422
    assert invalid.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "input.affectedArea" in invalid.json()["error"]["fieldErrors"]
    assert WorkflowRun.objects.count() == 0


@pytest.mark.parametrize(
    ("failure", "expected_status"),
    [
        (
            ProviderFailure(
                code="AI_TIMEOUT",
                message="The AI provider took too long to respond.",
                status=504,
                retryable=True,
            ),
            504,
        ),
        (
            ProviderFailure(
                code="INVALID_AI_OUTPUT",
                message="The AI provider returned invalid output.",
                status=502,
                retryable=True,
            ),
            502,
        ),
    ],
)
def test_provider_failures_persist_safe_failed_run(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
    failure: ProviderFailure,
    expected_status: int,
) -> None:
    class FailingProvider:
        def generate_structured(self, **kwargs):
            raise failure

    monkeypatch.setattr("runs.services.get_provider", lambda provider: FailingProvider())
    response = authenticated_client.post(
        "/api/v1/workflows/status-update/runs",
        data={"input": VALID_INPUTS["status-update"]},
        content_type="application/json",
    )

    assert response.status_code == expected_status
    assert response.json()["error"]["code"] == failure.code
    run = WorkflowRun.objects.get()
    assert run.status == WorkflowRun.Status.FAILED
    assert run.error_code == failure.code
    assert run.completed_at is not None
    assert run.result_json is None


@override_settings(AI_RATE_LIMIT_PER_MINUTE=1, AI_RATE_LIMIT_PER_DAY=30)
def test_personal_run_throttle_stops_call_before_reservation(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    authenticated_client.get("/api/v1/me")
    user = AppUser.objects.get(workos_user_id="user_test_primary")
    WorkflowRun.objects.create(user=user, workflow_id="bug-triage", input_json={})
    monkeypatch.setattr(
        "runs.services.get_provider",
        lambda provider: pytest.fail("provider should not be called"),
    )

    response = authenticated_client.post(
        "/api/v1/workflows/status-update/runs",
        data={"input": VALID_INPUTS["status-update"]},
        content_type="application/json",
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "RUN_RATE_LIMITED"
    assert WorkflowRun.objects.count() == 1


def test_execution_options_report_provider_availability(authenticated_client: Client) -> None:
    with override_settings(GEMINI_API_KEY="test", OPENAI_API_KEY=""):
        response = authenticated_client.get("/api/v1/execution-options")

    assert response.status_code == 200
    assert response.json()["defaultProvider"] == "gemini"
    assert response.json()["defaultIntelligence"] == "fast"
    assert response.json()["retentionDays"] == 30
    assert response.json()["providers"] == [
        {"id": "gemini", "label": "Gemini", "enabled": True},
        {"id": "openai", "label": "OpenAI", "enabled": False},
    ]
