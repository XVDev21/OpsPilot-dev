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

SUPPORTED_PROVIDERS = tuple(ProviderCredential.Provider.values)
QWEN_REGIONS = tuple(ProviderCredential.EndpointRegion.values)


@dataclass(frozen=True)
class PersonalCredential:
    api_key: str
    credential_id: int
    endpoint_region: str
    workspace_id: str


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
) -> tuple[str, str]:
    if provider != ProviderCredential.Provider.QWEN:
        return "", ""

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
    return region, normalized_workspace_id


@transaction.atomic
def save_provider_credential(
    *,
    user: AppUser,
    provider: str,
    api_key: str,
    endpoint_region: str | None,
    workspace_id: str | None,
) -> ProviderCredential:
    provider = validate_provider_name(provider)
    region, normalized_workspace_id = validate_provider_configuration(
        provider=provider,
        endpoint_region=endpoint_region,
        workspace_id=workspace_id,
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
            "endpoint_region": region,
            "workspace_id": normalized_workspace_id,
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
            "updatedAt": by_provider[provider].updated_at if provider in by_provider else None,
        }
        for provider in SUPPORTED_PROVIDERS
    ]
