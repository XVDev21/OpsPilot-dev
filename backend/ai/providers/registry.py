import re
from dataclasses import dataclass

from django.conf import settings

from accounts.models import AppUser
from ai.providers.bedrock import BedrockProvider
from ai.providers.compatible import OpenAICompatibleProvider
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
from integrations.connectors import connector_for_user
from integrations.models import LocalConnector, ProviderCredential
from integrations.network import validate_public_https_base_url
from integrations.services import personal_credential_for_user

_WORKSPACE_ID_PATTERN = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$")


@dataclass(frozen=True)
class ProviderDefinition:
    id: ProviderName
    label: str
    description: str
    supports_personal_key: bool = True
    supports_images: bool = False


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
        supports_images=True,
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
    ProviderDefinition(
        id="bedrock",
        label="Amazon Bedrock",
        description="AWS-hosted foundation models through a personal Bedrock bearer API key.",
    ),
    ProviderDefinition(
        id="custom",
        label="OpenAI-compatible",
        description="A public HTTPS endpoint with account-owned model routing.",
    ),
    ProviderDefinition(
        id="local",
        label="Local connector",
        description="Ollama, LM Studio, or vLLM through an outbound paired connector.",
        supports_personal_key=False,
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
        "bedrock": "",
        "custom": "",
        "local": "",
    }[provider]


def _platform_provider_is_enabled(provider: ProviderName) -> bool:
    if provider in {"bedrock", "custom", "local"}:
        return False
    if provider not in settings.AI_PLATFORM_PROVIDERS:
        return False
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
    if provider == "local":
        connector = connector_for_user(user) if user is not None else None
        return bool(connector and connector.token_digest and connector.paired_at)
    if (
        user is not None
        and ProviderCredential.objects.filter(user=user, provider=provider).exists()
    ):
        return True
    return _platform_provider_is_enabled(provider)


def credential_source_for(provider: ProviderName, *, user: AppUser) -> CredentialSource | None:
    if provider == "local":
        return "connector" if provider_is_enabled(provider, user=user) else None
    if ProviderCredential.objects.filter(user=user, provider=provider).exists():
        return "personal"
    return "platform" if _platform_provider_is_enabled(provider) else None


def get_provider(*, provider: ProviderName, user: AppUser) -> ResolvedProvider:
    if provider == "local":
        raise ProviderFailure(
            code="LOCAL_CONNECTOR_REQUIRED",
            message="This workflow must be claimed by the paired local connector.",
            status=409,
            retryable=True,
        )
    personal = personal_credential_for_user(user=user, provider=provider)
    if personal is not None:
        api_key = personal.api_key
        credential_source: CredentialSource = "personal"
        credential_id = personal.credential_id
        qwen_region = personal.endpoint_region
        qwen_workspace_id = personal.workspace_id
    else:
        api_key = _platform_key(provider) if _platform_provider_is_enabled(provider) else ""
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
    elif provider == "qwen":
        adapter = QwenProvider(
            api_key=api_key,
            base_url=qwen_base_url(region=qwen_region, workspace_id=qwen_workspace_id),
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    elif provider == "bedrock":
        adapter = BedrockProvider(
            api_key=api_key,
            region=personal.aws_region if personal is not None else "",
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    else:
        adapter = OpenAICompatibleProvider(
            api_key=api_key,
            base_url=validate_public_https_base_url(
                personal.base_url if personal is not None else ""
            ),
            timeout_seconds=settings.AI_REQUEST_TIMEOUT_SECONDS,
        )
    return ResolvedProvider(
        adapter=adapter,
        credential_source=credential_source,
        credential_id=credential_id,
    )


def model_for(
    provider: ProviderName,
    intelligence: IntelligenceLevel,
    *,
    user: AppUser | None = None,
) -> str:
    if provider == "local":
        connector = connector_for_user(user) if user is not None else None
        if connector is None or not connector.token_digest:
            raise ProviderFailure(
                code="AI_AUTH_ERROR",
                message="Pair a local connector before selecting local models.",
                status=503,
                retryable=False,
            )
        return _connector_model(connector, intelligence)
    if provider in {"bedrock", "custom"}:
        credential = (
            ProviderCredential.objects.filter(user=user, provider=provider).first()
            if user is not None
            else None
        )
        if credential is None:
            raise ProviderFailure(
                code="AI_AUTH_ERROR",
                message="Configure this model connection before running a workflow.",
                status=503,
                retryable=False,
            )
        return {
            "fast": credential.model_fast,
            "balanced": credential.model_balanced,
            "high": credential.model_high,
        }[intelligence]
    return settings.AI_MODEL_MAP[provider][intelligence]


def _connector_model(connector: LocalConnector, intelligence: IntelligenceLevel) -> str:
    return {
        "fast": connector.model_fast,
        "balanced": connector.model_balanced,
        "high": connector.model_high,
    }[intelligence]


def max_output_tokens_for(intelligence: IntelligenceLevel) -> int:
    return settings.AI_MAX_OUTPUT_TOKENS[intelligence]


def provider_definition_for(provider: ProviderName) -> ProviderDefinition:
    return next(definition for definition in PROVIDER_CATALOG if definition.id == provider)


def models_for_provider(provider: ProviderName, *, user: AppUser) -> dict[str, str | None]:
    models: dict[str, str | None] = {}
    for intelligence in ("fast", "balanced", "high"):
        try:
            models[intelligence] = model_for(provider, intelligence, user=user)
        except ProviderFailure:
            models[intelligence] = None
    return models
