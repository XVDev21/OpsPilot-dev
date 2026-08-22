from types import SimpleNamespace

import httpx
import pytest
from django.test import Client, override_settings
from pydantic import BaseModel

from accounts.models import AppUser
from ai.providers.bedrock import BedrockProvider
from ai.providers.compatible import OpenAICompatibleProvider
from ai.types import ProviderFailure
from common.errors import OpsPilotError
from integrations.models import ProviderCredential
from integrations.network import validate_public_https_base_url
from integrations.services import personal_credential_for_user

pytestmark = pytest.mark.django_db

ENCRYPTION_KEY = "test-provider-credential-secret-that-is-long-enough"


class Answer(BaseModel):
    answer: str


def test_custom_endpoint_requires_public_https(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "integrations.network.socket.getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, ("127.0.0.1", 443))],
    )
    with pytest.raises(Exception) as exc_info:
        validate_public_https_base_url("https://local-model.example/v1")
    assert getattr(exc_info.value, "code", None) == "VALIDATION_ERROR"

    monkeypatch.setattr(
        "integrations.network.socket.getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, ("203.0.113.8", 443))],
    )
    # Documentation networks are reserved and must also be rejected.
    with pytest.raises(OpsPilotError):
        validate_public_https_base_url("https://models.example/v1")

    monkeypatch.setattr(
        "integrations.network.socket.getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, ("8.8.8.8", 443))],
    )
    assert validate_public_https_base_url(" https://models.example/v1/ ") == (
        "https://models.example/v1"
    )


@override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY])
def test_bedrock_configuration_requires_region_and_all_tiers(
    authenticated_client: Client,
) -> None:
    missing = authenticated_client.put(
        "/api/v1/provider-credentials/bedrock",
        data={"apiKey": "bedrock-user-key-that-is-long-enough"},
        content_type="application/json",
    )
    valid = authenticated_client.put(
        "/api/v1/provider-credentials/bedrock",
        data={
            "apiKey": "bedrock-user-key-that-is-long-enough",
            "awsRegion": "ap-southeast-1",
            "modelFast": "amazon.nova-micro-v1:0",
            "modelBalanced": "amazon.nova-lite-v1:0",
            "modelHigh": "amazon.nova-pro-v1:0",
        },
        content_type="application/json",
    )

    assert missing.status_code == 422
    assert valid.status_code == 200
    assert valid.json()["awsRegion"] == "ap-southeast-1"
    stored = ProviderCredential.objects.get(provider="bedrock")
    assert "bedrock-user-key" not in stored.encrypted_api_key
    resolved = personal_credential_for_user(
        user=AppUser.objects.get(workos_user_id="user_test_primary"), provider="bedrock"
    )
    assert resolved is not None
    assert resolved.model_high == "amazon.nova-pro-v1:0"


@override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY])
def test_custom_connection_is_encrypted_and_normalized(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        "integrations.network.socket.getaddrinfo",
        lambda *args, **kwargs: [(None, None, None, None, ("8.8.8.8", 443))],
    )
    response = authenticated_client.put(
        "/api/v1/provider-credentials/custom",
        data={
            "apiKey": "custom-user-key-that-is-long-enough",
            "displayName": "Acme Models",
            "baseUrl": "https://models.example/v1/",
            "modelFast": "acme-small",
            "modelBalanced": "acme-medium",
            "modelHigh": "acme-large",
        },
        content_type="application/json",
    )
    assert response.status_code == 200
    assert response.json()["baseUrl"] == "https://models.example/v1"
    assert "apiKey" not in response.json()


def test_bedrock_provider_uses_bearer_converse_contract() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured["authorization"] = request.headers.get("Authorization")
        captured["url"] = str(request.url)
        return httpx.Response(
            200,
            json={
                "output": {"message": {"content": [{"text": '{"answer":"ready"}'}]}},
                "usage": {"inputTokens": 7, "outputTokens": 3},
            },
        )

    provider = BedrockProvider(api_key="bedrock-secret", region="ap-southeast-1", timeout_seconds=5)
    provider.client.close()
    provider.client = httpx.Client(transport=httpx.MockTransport(handler))
    result = provider.generate_structured(
        model="amazon.nova-lite-v1:0",
        system_instruction="Be precise.",
        user_content="Return the answer.",
        output_schema=Answer,
        max_output_tokens=200,
    )
    provider.client.close()

    assert captured["authorization"] == "Bearer bedrock-secret"
    assert "amazon.nova-lite-v1%3A0/converse" in captured["url"]
    assert result.output.answer == "ready"
    assert result.input_tokens == 7


def test_bedrock_provider_normalizes_auth_failure() -> None:
    provider = BedrockProvider(api_key="bad", region="us-east-1", timeout_seconds=5)
    provider.client.close()
    provider.client = httpx.Client(
        transport=httpx.MockTransport(lambda request: httpx.Response(403, json={}))
    )
    with pytest.raises(ProviderFailure) as exc_info:
        provider.generate_structured(
            model="amazon.nova-lite-v1:0",
            system_instruction="system",
            user_content="user",
            output_schema=Answer,
            max_output_tokens=100,
        )
    provider.client.close()
    assert exc_info.value.code == "AI_AUTH_ERROR"


@pytest.mark.parametrize(
    ("status", "payload", "expected_code"),
    [
        (429, {}, "AI_RATE_LIMITED"),
        (503, {}, "AI_UNAVAILABLE"),
        (400, {}, "AI_REQUEST_FAILED"),
        (200, {"output": {"message": {"content": []}}}, "INVALID_AI_OUTPUT"),
        (
            200,
            {"output": {"message": {"content": [{"text": "not-json"}]}}, "usage": {}},
            "INVALID_AI_OUTPUT",
        ),
    ],
)
def test_bedrock_provider_normalizes_remote_and_output_failures(
    status: int,
    payload: dict,
    expected_code: str,
) -> None:
    provider = BedrockProvider(api_key="key", region="us-east-1", timeout_seconds=5)
    provider.client.close()
    provider.client = httpx.Client(
        transport=httpx.MockTransport(lambda request: httpx.Response(status, json=payload))
    )
    with pytest.raises(ProviderFailure) as exc_info:
        provider.generate_structured(
            model="amazon.nova-lite-v1:0",
            system_instruction="system",
            user_content="user",
            output_schema=Answer,
            max_output_tokens=100,
        )
    provider.client.close()
    assert exc_info.value.code == expected_code


def test_openai_compatible_provider_validates_json() -> None:
    provider = OpenAICompatibleProvider(
        api_key="custom-secret", base_url="https://models.example/v1", timeout_seconds=5
    )
    provider.client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(
                create=lambda **kwargs: SimpleNamespace(
                    choices=[
                        SimpleNamespace(message=SimpleNamespace(content='{"answer":"ready"}'))
                    ],
                    usage=SimpleNamespace(prompt_tokens=5, completion_tokens=2),
                )
            )
        )
    )
    result = provider.generate_structured(
        model="acme-medium",
        system_instruction="system",
        user_content="user",
        output_schema=Answer,
        max_output_tokens=100,
    )
    assert result.output.answer == "ready"
    assert result.output_tokens == 2


def test_openai_compatible_provider_disables_redirects() -> None:
    provider = OpenAICompatibleProvider(
        api_key="custom-secret", base_url="https://models.example/v1", timeout_seconds=5
    )

    assert provider.client._client.follow_redirects is False
    provider.client.close()
