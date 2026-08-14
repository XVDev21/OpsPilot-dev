from types import SimpleNamespace

import httpx2
import openai
import pytest
from django.test import override_settings
from google.genai import errors

from ai.providers.gemini import GeminiProvider
from ai.providers.openai import OpenAIProvider
from ai.providers.registry import (
    get_provider,
    max_output_tokens_for,
    model_for,
    provider_is_enabled,
)
from ai.types import ProviderFailure
from workflows.schemas import BugTriageOutput

VALID_OUTPUT = {
    "summary": "Large exports stall.",
    "confirmedFacts": ["Small exports complete."],
    "evidenceGaps": ["Logs are missing."],
    "likelyCategory": "Export processing",
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


def test_provider_registry_keeps_keys_and_models_server_owned(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    with override_settings(GEMINI_API_KEY="", OPENAI_API_KEY=""):
        assert not provider_is_enabled("gemini")
        with pytest.raises(ProviderFailure):
            get_provider("openai")

    sentinel = object()
    monkeypatch.setattr("ai.providers.registry.GeminiProvider", lambda **kwargs: sentinel)
    with override_settings(GEMINI_API_KEY="secret"):
        assert provider_is_enabled("gemini")
        assert get_provider("gemini") is sentinel

    monkeypatch.setattr("ai.providers.registry.OpenAIProvider", lambda **kwargs: sentinel)
    with override_settings(OPENAI_API_KEY="secret"):
        assert provider_is_enabled("openai")
        assert get_provider("openai") is sentinel

    assert model_for("gemini", "fast")
    assert max_output_tokens_for("high") == 3200
