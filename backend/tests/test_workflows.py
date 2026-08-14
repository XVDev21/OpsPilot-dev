import pytest
from django.test import Client
from pydantic import ValidationError

from workflows.registry import WORKFLOW_REGISTRY, get_workflow

pytestmark = pytest.mark.django_db


def test_workflow_metadata_matches_the_three_product_jobs(authenticated_client: Client) -> None:
    response = authenticated_client.get("/api/v1/workflows")

    assert response.status_code == 200
    assert [workflow["id"] for workflow in response.json()] == [
        "bug-triage",
        "meeting-actions",
        "status-update",
    ]
    assert all(workflow["promptVersion"] == "v2-provider-neutral" for workflow in response.json())


def test_registry_has_input_and_output_schemas() -> None:
    assert set(WORKFLOW_REGISTRY) == {"bug-triage", "meeting-actions", "status-update"}
    assert get_workflow("missing") is None
    for workflow in WORKFLOW_REGISTRY.values():
        assert workflow.input_schema.model_json_schema()["type"] == "object"
        assert workflow.output_schema.model_json_schema()["type"] == "object"


def test_bug_triage_input_enforces_final_frontend_validation_contract() -> None:
    schema = WORKFLOW_REGISTRY["bug-triage"].input_schema

    with pytest.raises(ValidationError):
        schema.model_validate(
            {
                "title": "No",
                "affectedArea": "A",
                "observedBehavior": "short",
                "expectedBehavior": "short",
                "evidence": [],
            }
        )
