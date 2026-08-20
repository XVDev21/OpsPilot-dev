from types import SimpleNamespace

import httpx2
import openai
import pytest
from django.test import override_settings
from google.genai import errors

from accounts.models import AppUser
from ai.providers.gemini import GeminiProvider
from ai.providers.openai import OpenAIProvider
from ai.providers.qwen import QwenProvider
from ai.providers.registry import (
    credential_source_for,
    get_provider,
    max_output_tokens_for,
    model_for,
    provider_is_enabled,
    qwen_base_url,
)
from ai.types import ProviderFailure
from integrations.services import save_provider_credential
from workflows.schemas import BugTriageOutput

VALID_OUTPUT = {
    "summary": "Large exports stall.",
    "confirmedFacts": ["Small exports complete."],
    "evidenceGaps": ["Logs are missing."],
    "likelyCategory": "Export processing",
    "issueType": "product-defect",
    "routing": {
        "team": "engineering",
        "ownerId": None,
        "rationale": "Repeatable behavior warrants technical validation.",
    },
    "recommendedChecks": ["Review export job logs."],
    "confidence": 0.7,
    "humanReviewNotice": "Review is required.",
}


class RaisingMethod:
    def __init__(self, error: Exception) -> None:
        self.error = error

    def generate_content(self, **kwargs):
        raise self.error

    def parse(self, **kwargs):
        raise self.error

    def create(self, **kwargs):
        raise self.error


def test_gemini_structured_success_and_json_fallback() -> None:
    responses = [
        SimpleNamespace(
            parsed=BugTriageOutput.model_validate(VALID_OUTPUT),
            text="",
            usage_metadata=SimpleNamespace(prompt_token_count=12, candidates_token_count=8),
        ),
        SimpleNamespace(
            parsed=None,
            text=BugTriageOutput.model_validate(VALID_OUTPUT).model_dump_json(),
            usage_metadata=None,
        ),
    ]
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.client = SimpleNamespace(
        models=SimpleNamespace(generate_content=lambda **kwargs: responses.pop(0))
    )

    first = provider.generate_structured(
        model="gemini-test",
        system_instruction="system",
        user_content="input",
        output_schema=BugTriageOutput,
        max_output_tokens=100,
    )
    second = provider.generate_structured(
        model="gemini-test",
        system_instruction="system",
        user_content="input",
        output_schema=BugTriageOutput,
        max_output_tokens=100,
    )

    assert first.output.summary == "Large exports stall."
    assert (first.input_tokens, first.output_tokens) == (12, 8)
    assert second.output.summary == "Large exports stall."
    assert second.input_tokens is None


@pytest.mark.parametrize(
    ("status_code", "code", "status", "retryable"),
    [
        (401, "AI_AUTH_ERROR", 503, False),
        (429, "AI_RATE_LIMITED", 429, True),
        (503, "AI_UNAVAILABLE", 503, True),
        (400, "AI_REQUEST_FAILED", 502, False),
    ],
)
def test_gemini_api_errors_are_normalized(
    status_code: int, code: str, status: int, retryable: bool
) -> None:
    failure = GeminiProvider._normalize_api_error(errors.APIError(status_code, {}))
    assert (failure.code, failure.status, failure.retryable) == (code, status, retryable)


@pytest.mark.parametrize(
    ("error", "code"),
    [
        (TimeoutError(), "AI_TIMEOUT"),
        (errors.APIError(429, {}), "AI_RATE_LIMITED"),
    ],
)
def test_gemini_generate_raises_safe_failure(error: Exception, code: str) -> None:
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.client = SimpleNamespace(models=RaisingMethod(error))

    with pytest.raises(ProviderFailure, match="provider") as captured:
        provider.generate_structured(
            model="gemini-test",
            system_instruction="system",
            user_content="input",
            output_schema=BugTriageOutput,
            max_output_tokens=100,
        )

    assert captured.value.code == code


def test_gemini_invalid_json_is_normalized() -> None:
    provider = GeminiProvider.__new__(GeminiProvider)
    provider.client = SimpleNamespace(
        models=SimpleNamespace(
            generate_content=lambda **kwargs: SimpleNamespace(
                parsed=None, text="{}", usage_metadata=None
            )
        )
    )
    with pytest.raises(ProviderFailure) as captured:
        provider.generate_structured(
            model="gemini-test",
            system_instruction="system",
            user_content="input",
            output_schema=BugTriageOutput,
            max_output_tokens=100,
        )
    assert captured.value.code == "INVALID_AI_OUTPUT"


def test_openai_structured_success_and_missing_output() -> None:
    responses = [
        SimpleNamespace(
            output_parsed=BugTriageOutput.model_validate(VALID_OUTPUT),
            usage=SimpleNamespace(input_tokens=18, output_tokens=9),
        ),
        SimpleNamespace(output_parsed=None, usage=None),
    ]
    provider = OpenAIProvider.__new__(OpenAIProvider)
    provider.client = SimpleNamespace(
        responses=SimpleNamespace(parse=lambda **kwargs: responses.pop(0))
    )
    kwargs = {
        "model": "gpt-test",
        "system_instruction": "system",
        "user_content": "input",
        "output_schema": BugTriageOutput,
        "max_output_tokens": 100,
    }

    result = provider.generate_structured(**kwargs)
    assert result.output.summary == "Large exports stall."
    assert (result.input_tokens, result.output_tokens) == (18, 9)
    with pytest.raises(ProviderFailure) as captured:
        provider.generate_structured(**kwargs)
    assert captured.value.code == "INVALID_AI_OUTPUT"


def openai_error(status: int, *, code: str | None = None) -> openai.APIStatusError:
    request = httpx2.Request("POST", "https://api.openai.test/v1/responses")
    response = httpx2.Response(status, request=request)
    if status == 401:
        return openai.AuthenticationError("auth", response=response, body=None)
    if status == 429:
        return openai.RateLimitError("rate", response=response, body={"code": code})
    return openai.APIStatusError("status", response=response, body=None)


@pytest.mark.parametrize(
    ("error", "code", "retryable"),
    [
        (openai_error(401), "AI_AUTH_ERROR", False),
        (openai_error(429), "AI_RATE_LIMITED", True),
        (openai_error(429, code="insufficient_quota"), "AI_RATE_LIMITED", False),
        (
            openai.APITimeoutError(httpx2.Request("POST", "https://api.openai.test")),
            "AI_TIMEOUT",
            True,
        ),
        (
            openai.APIConnectionError(request=httpx2.Request("POST", "https://api.openai.test")),
            "AI_UNAVAILABLE",
            True,
        ),
        (openai_error(503), "AI_UNAVAILABLE", True),
        (openai_error(400), "AI_REQUEST_FAILED", False),
    ],
)
def test_openai_errors_are_normalized(error: Exception, code: str, retryable: bool) -> None:
    provider = OpenAIProvider.__new__(OpenAIProvider)
    provider.client = SimpleNamespace(responses=RaisingMethod(error))

    with pytest.raises(ProviderFailure) as captured:
        provider.generate_structured(
            model="gpt-test",
            system_instruction="system",
            user_content="input",
            output_schema=BugTriageOutput,
            max_output_tokens=100,
        )
    assert (captured.value.code, captured.value.retryable) == (code, retryable)


@pytest.mark.django_db
def test_provider_registry_keeps_keys_and_models_server_owned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = AppUser.objects.create(workos_user_id="provider-registry-user")
    with override_settings(GEMINI_API_KEY="", OPENAI_API_KEY="", QWEN_API_KEY=""):
        assert not provider_is_enabled("gemini")
        with pytest.raises(ProviderFailure):
            get_provider(provider="openai", user=user)

    sentinel = object()
    monkeypatch.setattr("ai.providers.registry.GeminiProvider", lambda **kwargs: sentinel)
    with override_settings(GEMINI_API_KEY="secret", AI_PLATFORM_PROVIDERS=["gemini"]):
        assert provider_is_enabled("gemini")
        resolved = get_provider(provider="gemini", user=user)
        assert resolved.adapter is sentinel
        assert resolved.credential_source == "platform"

    monkeypatch.setattr("ai.providers.registry.OpenAIProvider", lambda **kwargs: sentinel)
    with override_settings(OPENAI_API_KEY="secret", AI_PLATFORM_PROVIDERS=["openai"]):
        assert provider_is_enabled("openai")
        assert get_provider(provider="openai", user=user).adapter is sentinel

    monkeypatch.setattr("ai.providers.registry.QwenProvider", lambda **kwargs: sentinel)
    with override_settings(
        QWEN_API_KEY="secret",
        QWEN_REGION="us",
        QWEN_WORKSPACE_ID="",
        AI_PLATFORM_PROVIDERS=["qwen"],
    ):
        assert provider_is_enabled("qwen")
        assert get_provider(provider="qwen", user=user).adapter is sentinel

    assert model_for("gemini", "fast")
    assert max_output_tokens_for("high") == 3200


@pytest.mark.django_db
def test_platform_provider_key_is_ignored_when_provider_is_not_allowlisted() -> None:
    user = AppUser.objects.create(workos_user_id="provider-policy-user")

    with override_settings(OPENAI_API_KEY="funded-looking-key", AI_PLATFORM_PROVIDERS=["gemini"]):
        assert not provider_is_enabled("openai")
        with pytest.raises(ProviderFailure):
            get_provider(provider="openai", user=user)


@pytest.mark.django_db
@override_settings(
    PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=["test-provider-credential-secret-that-is-long-enough"],
    OPENAI_API_KEY="platform-openai-key",
)
def test_personal_provider_key_takes_precedence_without_leaving_the_backend(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = AppUser.objects.create(workos_user_id="personal-provider-user")
    save_provider_credential(
        user=user,
        provider="openai",
        api_key="sk-personal-openai-key-that-is-long-enough",
        endpoint_region=None,
        workspace_id=None,
    )
    constructor_args: dict[str, object] = {}
    sentinel = object()

    def capture_provider(**kwargs):
        constructor_args.update(kwargs)
        return sentinel

    monkeypatch.setattr("ai.providers.registry.OpenAIProvider", capture_provider)

    resolved = get_provider(provider="openai", user=user)

    assert resolved.adapter is sentinel
    assert resolved.credential_source == "personal"
    assert resolved.credential_id is not None
    assert constructor_args["api_key"] == "sk-personal-openai-key-that-is-long-enough"
    assert credential_source_for("openai", user=user) == "personal"


def test_qwen_structured_success_and_invalid_output() -> None:
    request_args: list[dict] = []
    responses = [
        SimpleNamespace(
            choices=[
                SimpleNamespace(
                    message=SimpleNamespace(
                        content=BugTriageOutput.model_validate(VALID_OUTPUT).model_dump_json()
                    )
                )
            ],
            usage=SimpleNamespace(prompt_tokens=21, completion_tokens=11),
        ),
        SimpleNamespace(
            choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))],
            usage=None,
        ),
    ]

    def create_completion(**kwargs):
        request_args.append(kwargs)
        return responses.pop(0)

    provider = QwenProvider.__new__(QwenProvider)
    provider.client = SimpleNamespace(
        chat=SimpleNamespace(completions=SimpleNamespace(create=create_completion))
    )
    kwargs = {
        "model": "qwen-test",
        "system_instruction": "Return structured output.",
        "user_content": "validated input",
        "output_schema": BugTriageOutput,
        "max_output_tokens": 100,
    }

    result = provider.generate_structured(**kwargs)
    assert result.output.summary == "Large exports stall."
    assert (result.input_tokens, result.output_tokens) == (21, 11)
    assert request_args[0]["response_format"] == {"type": "json_object"}
    assert request_args[0]["extra_body"] == {"enable_thinking": False}
    assert request_args[0]["max_completion_tokens"] == 100
    assert "max_tokens" not in request_args[0]
    with pytest.raises(ProviderFailure) as captured:
        provider.generate_structured(**kwargs)
    assert captured.value.code == "INVALID_AI_OUTPUT"


def test_qwen_client_is_bounded_to_the_resolved_endpoint(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    constructor_args: dict[str, object] = {}

    def capture_client(**kwargs):
        constructor_args.update(kwargs)
        return object()

    monkeypatch.setattr("ai.providers.qwen.OpenAI", capture_client)

    QwenProvider(
        api_key="qwen-personal-key-that-is-long-enough",
        base_url="https://dashscope-us.aliyuncs.com/compatible-mode/v1",
        timeout_seconds=30,
    )

    assert constructor_args == {
        "api_key": "qwen-personal-key-that-is-long-enough",
        "base_url": "https://dashscope-us.aliyuncs.com/compatible-mode/v1",
        "timeout": 30,
        "max_retries": 0,
    }


def test_qwen_empty_output_is_normalized() -> None:
    provider = QwenProvider.__new__(QwenProvider)
    provider.client = SimpleNamespace(
        chat=SimpleNamespace(
            completions=SimpleNamespace(
                create=lambda **kwargs: SimpleNamespace(choices=[], usage=None)
            )
        )
    )

    with pytest.raises(ProviderFailure) as captured:
        provider.generate_structured(
            model="qwen-test",
            system_instruction="Return structured output.",
            user_content="validated input",
            output_schema=BugTriageOutput,
            max_output_tokens=100,
        )

    assert captured.value.code == "INVALID_AI_OUTPUT"


@pytest.mark.parametrize(
    ("error", "code", "retryable"),
    [
        (openai_error(401), "AI_AUTH_ERROR", False),
        (openai_error(429), "AI_RATE_LIMITED", True),
        (
            openai.APITimeoutError(httpx2.Request("POST", "https://qwen-api.test")),
            "AI_TIMEOUT",
            True,
        ),
        (
            openai.APIConnectionError(request=httpx2.Request("POST", "https://qwen-api.test")),
            "AI_UNAVAILABLE",
            True,
        ),
        (openai_error(503), "AI_UNAVAILABLE", True),
        (openai_error(400), "AI_REQUEST_FAILED", False),
    ],
)
def test_qwen_errors_are_normalized(error: Exception, code: str, retryable: bool) -> None:
    provider = QwenProvider.__new__(QwenProvider)
    provider.client = SimpleNamespace(chat=SimpleNamespace(completions=RaisingMethod(error)))

    with pytest.raises(ProviderFailure) as captured:
        provider.generate_structured(
            model="qwen-test",
            system_instruction="Return structured output.",
            user_content="validated input",
            output_schema=BugTriageOutput,
            max_output_tokens=100,
        )

    assert (captured.value.code, captured.value.retryable) == (code, retryable)


@pytest.mark.parametrize(
    ("region", "workspace_id", "expected"),
    [
        (
            "singapore",
            "ws-test-123",
            "https://ws-test-123.ap-southeast-1.maas.aliyuncs.com/compatible-mode/v1",
        ),
        (
            "beijing",
            "ws-test-123",
            "https://ws-test-123.cn-beijing.maas.aliyuncs.com/compatible-mode/v1",
        ),
        ("us", "", "https://dashscope-us.aliyuncs.com/compatible-mode/v1"),
    ],
)
def test_qwen_base_urls_are_server_constructed(
    region: str, workspace_id: str, expected: str
) -> None:
    assert qwen_base_url(region=region, workspace_id=workspace_id) == expected


def test_qwen_rejects_incomplete_or_unsafe_endpoint_configuration() -> None:
    for workspace_id in ("", "evil.example.com", "../metadata", "ws-test-"):
        with pytest.raises(ProviderFailure):
            qwen_base_url(region="singapore", workspace_id=workspace_id)
