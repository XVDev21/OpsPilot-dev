from django.conf import settings

from ai.providers.gemini import GeminiProvider
from ai.providers.openai import OpenAIProvider
from ai.types import AIProvider, IntelligenceLevel, ProviderFailure, ProviderName


def provider_is_enabled(provider: ProviderName) -> bool:
    return bool(settings.GEMINI_API_KEY if provider == "gemini" else settings.OPENAI_API_KEY)


def get_provider(provider: ProviderName) -> AIProvider:
    if not provider_is_enabled(provider):
        raise ProviderFailure(
            code="AI_AUTH_ERROR",
            message="The selected AI provider is not available in this environment.",
            status=503,
            retryable=False,
        )
    if provider == "gemini":
        return GeminiProvider(
            api_key=settings.GEMINI_API_KEY,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    return OpenAIProvider(
        api_key=settings.OPENAI_API_KEY,
        timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
    )


def model_for(provider: ProviderName, intelligence: IntelligenceLevel) -> str:
    return settings.AI_MODEL_MAP[provider][intelligence]


def max_output_tokens_for(intelligence: IntelligenceLevel) -> int:
    return settings.AI_MAX_OUTPUT_TOKENS[intelligence]
