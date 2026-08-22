import hashlib
from dataclasses import dataclass

from django.db import transaction
from django.utils import timezone

from accounts.models import AppUser
from common.errors import OpsPilotError
from integrations.crypto import (
    CredentialEncryptionUnavailable,
    decrypt_api_key,
    encrypt_api_key,
)
from integrations.models import ProviderCredential
from integrations.network import validate_public_https_base_url

SUPPORTED_PROVIDERS = tuple(ProviderCredential.Provider.values)
QWEN_REGIONS = tuple(ProviderCredential.EndpointRegion.values)


@dataclass(frozen=True)
class PersonalCredential:
    api_key: str
    credential_id: int
    endpoint_region: str
    workspace_id: str
    display_name: str
    base_url: str
    aws_region: str
    model_fast: str
    model_balanced: str
    model_high: str


def _storage_error() -> OpsPilotError:
    return OpsPilotError(
        code="CREDENTIAL_STORAGE_UNAVAILABLE",
        message="Personal provider credentials are temporarily unavailable.",
        status=503,
        retryable=True,
    )


def validate_provider_name(provider: str) -> str:
    if provider not in SUPPORTED_PROVIDERS:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That AI provider integration is not available.",
            status=404,
        )
    return provider


def validate_provider_configuration(
    *,
    provider: str,
    endpoint_region: str | None,
    workspace_id: str | None,
    display_name: str | None,
    base_url: str | None,
    aws_region: str | None,
    model_fast: str | None,
    model_balanced: str | None,
    model_high: str | None,
) -> dict[str, str]:
    configuration = {
        "endpoint_region": "",
        "workspace_id": "",
        "display_name": "",
        "base_url": "",
        "aws_region": "",
        "model_fast": "",
        "model_balanced": "",
        "model_high": "",
    }
    model_values = {
        "modelFast": model_fast or "",
        "modelBalanced": model_balanced or "",
        "modelHigh": model_high or "",
    }
    if provider == ProviderCredential.Provider.BEDROCK:
        if not aws_region:
            raise OpsPilotError(
                code="VALIDATION_ERROR",
                message="Choose the AWS Region that hosts your Bedrock models.",
                status=422,
                field_errors={"awsRegion": ["Choose an approved Amazon Bedrock Region."]},
            )
        _require_tier_models(model_values)
        return {
            **configuration,
            "display_name": (display_name or "Amazon Bedrock").strip(),
            "aws_region": aws_region,
            "model_fast": model_fast or "",
            "model_balanced": model_balanced or "",
            "model_high": model_high or "",
        }
    if provider == ProviderCredential.Provider.CUSTOM:
        if not base_url:
            raise OpsPilotError(
                code="VALIDATION_ERROR",
                message="Enter the public HTTPS endpoint for this provider.",
                status=422,
                field_errors={"baseUrl": ["A public HTTPS endpoint is required."]},
            )
        _require_tier_models(model_values)
        return {
            **configuration,
            "display_name": (display_name or "Custom model").strip(),
            "base_url": validate_public_https_base_url(base_url),
            "model_fast": model_fast or "",
            "model_balanced": model_balanced or "",
            "model_high": model_high or "",
        }
    if provider != ProviderCredential.Provider.QWEN:
        return configuration

    region = endpoint_region or ProviderCredential.EndpointRegion.SINGAPORE
    if region not in QWEN_REGIONS:
        raise OpsPilotError(
            code="VALIDATION_ERROR",
            message="Choose a supported Qwen API region.",
            status=422,
            field_errors={"endpointRegion": ["Choose Singapore, US, or Beijing."]},
        )
    normalized_workspace_id = (workspace_id or "").strip()
    if region != ProviderCredential.EndpointRegion.US and not normalized_workspace_id:
        raise OpsPilotError(
            code="VALIDATION_ERROR",
            message="A Model Studio workspace ID is required for this Qwen region.",
            status=422,
            field_errors={"workspaceId": ["Enter the workspace ID shown in Model Studio."]},
        )
    return {
        **configuration,
        "endpoint_region": region,
        "workspace_id": normalized_workspace_id,
    }


def _require_tier_models(models: dict[str, str]) -> None:
    missing = {
        field: ["Choose a model for every intelligence level."]
        for field, value in models.items()
        if not value
    }
    if missing:
        raise OpsPilotError(
            code="VALIDATION_ERROR",
            message="Map Efficient, Balanced, and Deep before saving this connection.",
            status=422,
            field_errors=missing,
        )


@transaction.atomic
def save_provider_credential(
    *,
    user: AppUser,
    provider: str,
    api_key: str,
    endpoint_region: str | None,
    workspace_id: str | None,
    display_name: str | None = None,
    base_url: str | None = None,
    aws_region: str | None = None,
    model_fast: str | None = None,
    model_balanced: str | None = None,
    model_high: str | None = None,
) -> ProviderCredential:
    provider = validate_provider_name(provider)
    configuration = validate_provider_configuration(
        provider=provider,
        endpoint_region=endpoint_region,
        workspace_id=workspace_id,
        display_name=display_name,
        base_url=base_url,
        aws_region=aws_region,
        model_fast=model_fast,
        model_balanced=model_balanced,
        model_high=model_high,
    )
    try:
        encrypted_api_key = encrypt_api_key(api_key)
    except CredentialEncryptionUnavailable as exc:
        raise _storage_error() from exc

    credential, _ = ProviderCredential.objects.update_or_create(
        user=user,
        provider=provider,
        defaults={
            "encrypted_api_key": encrypted_api_key,
            "key_fingerprint": hashlib.sha256(api_key.encode("utf-8")).hexdigest()[:12],
            **configuration,
        },
    )
    return credential


def personal_credential_for_user(*, user: AppUser, provider: str) -> PersonalCredential | None:
    credential = ProviderCredential.objects.filter(user=user, provider=provider).first()
    if credential is None:
        return None
    try:
        api_key = decrypt_api_key(credential.encrypted_api_key)
    except CredentialEncryptionUnavailable as exc:
        raise _storage_error() from exc
    return PersonalCredential(
        api_key=api_key,
        credential_id=credential.pk,
        endpoint_region=credential.endpoint_region,
        workspace_id=credential.workspace_id,
        display_name=credential.display_name,
        base_url=credential.base_url,
        aws_region=credential.aws_region,
        model_fast=credential.model_fast,
        model_balanced=credential.model_balanced,
        model_high=credential.model_high,
    )


def mark_credential_used(credential_id: int | None) -> None:
    if credential_id is not None:
        ProviderCredential.objects.filter(pk=credential_id).update(last_used_at=timezone.now())


def delete_provider_credential(*, user: AppUser, provider: str) -> None:
    provider = validate_provider_name(provider)
    ProviderCredential.objects.filter(user=user, provider=provider).delete()


def credential_summaries_for_user(user: AppUser) -> list[dict]:
    by_provider = {
        credential.provider: credential
        for credential in ProviderCredential.objects.filter(user=user)
    }
    return [
        {
            "provider": provider,
            "configured": provider in by_provider,
            "keyFingerprint": (
                by_provider[provider].key_fingerprint if provider in by_provider else None
            ),
            "endpointRegion": (
                by_provider[provider].endpoint_region or None if provider in by_provider else None
            ),
            "workspaceId": (
                by_provider[provider].workspace_id or None if provider in by_provider else None
            ),
            "displayName": (
                by_provider[provider].display_name or None if provider in by_provider else None
            ),
            "baseUrl": by_provider[provider].base_url or None if provider in by_provider else None,
            "awsRegion": (
                by_provider[provider].aws_region or None if provider in by_provider else None
            ),
            "modelFast": (
                by_provider[provider].model_fast or None if provider in by_provider else None
            ),
            "modelBalanced": (
                by_provider[provider].model_balanced or None if provider in by_provider else None
            ),
            "modelHigh": (
                by_provider[provider].model_high or None if provider in by_provider else None
            ),
            "updatedAt": by_provider[provider].updated_at if provider in by_provider else None,
        }
        for provider in SUPPORTED_PROVIDERS
    ]
