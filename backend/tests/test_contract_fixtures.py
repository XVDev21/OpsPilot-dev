import json
from pathlib import Path

from accounts.schemas import AppUserSchema
from common.schemas import ApiErrorEnvelope
from integrations.schemas import ProviderCredentialList
from runs.schemas import RunListResponse, WorkflowRunSchema
from workflows.schemas import ExecutionOptions

CONTRACTS_DIR = Path(__file__).resolve().parents[2] / "contracts" / "v1"


def fixture(name: str):
    return json.loads((CONTRACTS_DIR / name).read_text(encoding="utf-8"))


def test_shared_contract_fixtures_validate_against_backend_schemas() -> None:
    ApiErrorEnvelope.model_validate(fixture("api-error.json"))
    AppUserSchema.model_validate(fixture("current-user.json"))
    WorkflowRunSchema.model_validate(fixture("workflow-run.json"))
    RunListResponse.model_validate(fixture("run-list.json"))
    ExecutionOptions.model_validate(fixture("execution-options.json"))
    ProviderCredentialList.model_validate(fixture("provider-credentials.json"))
