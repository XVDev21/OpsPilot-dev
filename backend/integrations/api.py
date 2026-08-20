from ninja import Router, Status

from integrations.schemas import (
    ProviderCredentialInput,
    ProviderCredentialList,
    ProviderCredentialSummary,
)
from integrations.services import (
    credential_summaries_for_user,
    delete_provider_credential,
    save_provider_credential,
)

router = Router(tags=["provider integrations"])


@router.get(
    "/provider-credentials",
    response=ProviderCredentialList,
    summary="Personal AI provider credential status",
)
def list_provider_credentials(request):
    return {"items": credential_summaries_for_user(request.auth.user)}


@router.put(
    "/provider-credentials/{provider}",
    response=ProviderCredentialSummary,
    summary="Save or rotate a personal AI provider credential",
)
def put_provider_credential(request, provider: str, payload: ProviderCredentialInput):
    credential = save_provider_credential(
        user=request.auth.user,
        provider=provider,
        api_key=payload.apiKey,
        endpoint_region=payload.endpointRegion,
        workspace_id=payload.workspaceId,
    )
    return {
        "provider": credential.provider,
        "configured": True,
        "keyFingerprint": credential.key_fingerprint,
        "endpointRegion": credential.endpoint_region or None,
        "workspaceId": credential.workspace_id or None,
        "updatedAt": credential.updated_at,
    }


@router.delete(
    "/provider-credentials/{provider}",
    response={204: None},
    summary="Delete a personal AI provider credential",
)
def remove_provider_credential(request, provider: str):
    delete_provider_credential(user=request.auth.user, provider=provider)
    return Status(204, None)
