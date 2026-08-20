import re
from dataclasses import dataclass

from django.conf import settings

from accounts.models import AppUser
from ai.providers.gemini import GeminiProvider
from ai.providers.openai import OpenAIProvider
from ai.providers.qwen import QwenProvider
from ai.types import (
    AIProvider,
    CredentialSource,
    IntelligenceLevel,
    ProviderFailure,
    ProviderName,
)
from integrations.models import ProviderCredential
from integrations.services import personal_credential_for_user

_WORKSPACE_ID_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$")


@dataclass(frozen=True)
class ProviderDefinition:
    id: ProviderName
    label: str
    description: str


@dataclass(frozen=True)
class ResolvedProvider:
    adapter: AIProvider
    credential_source: CredentialSource
    credential_id: int | None = None


PROVIDER_CATALOG = (
    ProviderDefinition(
        id="gemini",
        label="Gemini",
        description="Google models with the default low-cost structured workflow route.",
    ),
    ProviderDefinition(
        id="openai",
        label="OpenAI",
        description="OpenAI Responses models using the same validated workflow contracts.",
    ),
    ProviderDefinition(
        id="qwen",
        label="Qwen",
        description="Alibaba Cloud Model Studio through its OpenAI-compatible API.",
    ),
)


def qwen_base_url(*, region: str, workspace_id: str) -> str:
    if region == ProviderCredential.EndpointRegion.US:
        return "https://dashscope-us.aliyuncs.com/compatible-mode/v1"
    if region not in {
        ProviderCredential.EndpointRegion.SINGAPORE,
        ProviderCredential.EndpointRegion.BEIJING,
    } or not _WORKSPACE_ID_PATTERN.fullmatch(workspace_id):
        raise ProviderFailure(
            code="AI_AUTH_ERROR",
            message="The selected Qwen provider configuration is incomplete.",
            status=503,
            retryable=False,
        )
    region_host = (
        "ap-southeast-1.maas.aliyuncs.com"
        if region == ProviderCredential.EndpointRegion.SINGAPORE
        else "cn-beijing.maas.aliyuncs.com"
    )
    return f"https://{workspace_id.lower()}.{region_host}/compatible-mode/v1"


def _platform_key(provider: ProviderName) -> str:
    return {
        "gemini": settings.GEMINI_API_KEY,
        "openai": settings.OPENAI_API_KEY,
        "qwen": settings.QWEN_API_KEY,
    }[provider]


def _platform_provider_is_enabled(provider: ProviderName) -> bool:
    if not _platform_key(provider):
        return False
    if provider != "qwen":
        return True
    try:
        qwen_base_url(region=settings.QWEN_REGION, workspace_id=settings.QWEN_WORKSPACE_ID)
    except ProviderFailure:
        return False
    return True


def provider_is_enabled(provider: ProviderName, *, user: AppUser | None = None) -> bool:
    if (
        user is not None
        and ProviderCredential.objects.filter(user=user, provider=provider).exists()
    ):
        return True
    return _platform_provider_is_enabled(provider)


def credential_source_for(provider: ProviderName, *, user: AppUser) -> CredentialSource | None:
    if ProviderCredential.objects.filter(user=user, provider=provider).exists():
        return "personal"
    return "platform" if _platform_provider_is_enabled(provider) else None


def get_provider(*, provider: ProviderName, user: AppUser) -> ResolvedProvider:
    personal = personal_credential_for_user(user=user, provider=provider)
    if personal is not None:
        api_key = personal.api_key
        credential_source: CredentialSource = "personal"
        credential_id = personal.credential_id
        qwen_region = personal.endpoint_region
        qwen_workspace_id = personal.workspace_id
    else:
        api_key = _platform_key(provider)
        credential_source = "platform"
        credential_id = None
        qwen_region = settings.QWEN_REGION
        qwen_workspace_id = settings.QWEN_WORKSPACE_ID

    if not api_key:
        raise ProviderFailure(
            code="AI_AUTH_ERROR",
            message="The selected AI provider is not configured for this account.",
            status=503,
            retryable=False,
        )

    if provider == "gemini":
        adapter: AIProvider = GeminiProvider(
            api_key=api_key,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    elif provider == "openai":
        adapter = OpenAIProvider(
            api_key=api_key,
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    else:
        adapter = QwenProvider(
            api_key=api_key,
            base_url=qwen_base_url(region=qwen_region, workspace_id=qwen_workspace_id),
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    return ResolvedProvider(
        adapter=adapter,
        credential_source=credential_source,
        credential_id=credential_id,
    )


def model_for(provider: ProviderName, intelligence: IntelligenceLevel) -> str:
    return settings.AI_MODEL_MAP[provider][intelligence]


def max_output_tokens_for(intelligence: IntelligenceLevel) -> int:
    return settings.AI_MAX_OUTPUT_TOKENS[intelligence]
