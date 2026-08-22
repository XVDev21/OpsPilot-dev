from uuid import UUID

from ninja import Router, Status

from integrations.connectors import (
    authenticate_connector,
    connector_for_user,
    connector_summary,
    create_pairing,
    delete_connector,
    redeem_pairing,
)
from integrations.schemas import (
    ConnectorJobResultInput,
    ConnectorJobSchema,
    ConnectorPairInput,
    ConnectorPairResult,
    LocalConnectorEnvelope,
    LocalConnectorPairing,
    LocalConnectorPairingInput,
    ProviderCredentialInput,
    ProviderCredentialList,
    ProviderCredentialSummary,
)
from integrations.services import (
    credential_summaries_for_user,
    delete_provider_credential,
    save_provider_credential,
)
from runs.local_jobs import claim_next_job, complete_job
from runs.schemas import WorkflowRunSchema

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
        display_name=payload.displayName,
        base_url=payload.baseUrl,
        aws_region=payload.awsRegion,
        model_fast=payload.modelFast,
        model_balanced=payload.modelBalanced,
        model_high=payload.modelHigh,
    )
    return {
        "provider": credential.provider,
        "configured": True,
        "keyFingerprint": credential.key_fingerprint,
        "endpointRegion": credential.endpoint_region or None,
        "workspaceId": credential.workspace_id or None,
        "displayName": credential.display_name or None,
        "baseUrl": credential.base_url or None,
        "awsRegion": credential.aws_region or None,
        "modelFast": credential.model_fast or None,
        "modelBalanced": credential.model_balanced or None,
        "modelHigh": credential.model_high or None,
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


@router.get(
    "/local-connector",
    response=LocalConnectorEnvelope,
    summary="Local model connector status",
)
def get_local_connector(request):
    connector = connector_for_user(request.auth.user)
    return {"connector": connector_summary(connector) if connector is not None else None}


@router.post(
    "/local-connector/pairing",
    response={201: LocalConnectorPairing},
    summary="Create a one-time local connector pairing",
)
def create_local_connector_pairing(request, payload: LocalConnectorPairingInput):
    connector, pairing_code = create_pairing(
        user=request.auth.user,
        name=payload.name,
        model_fast=payload.modelFast,
        model_balanced=payload.modelBalanced,
        model_high=payload.modelHigh,
    )
    return Status(
        201,
        {
            "connector": connector_summary(connector),
            "pairingCode": pairing_code,
            "expiresAt": connector.pairing_expires_at,
        },
    )


@router.delete(
    "/local-connector/{connector_id}",
    response={204: None},
    summary="Disconnect a local model connector",
)
def remove_local_connector(request, connector_id: UUID):
    delete_connector(user=request.auth.user, connector_id=connector_id)
    return Status(204, None)


@router.post(
    "/connectors/pair",
    auth=None,
    response=ConnectorPairResult,
    summary="Redeem a local connector pairing code",
)
def pair_connector(request, payload: ConnectorPairInput):
    connector, token = redeem_pairing(
        connector_id=payload.connectorId,
        pairing_code=payload.pairingCode,
    )
    return {"connectorId": connector.id, "connectorToken": token}


@router.post(
    "/connectors/{connector_id}/claim",
    auth=None,
    response={200: ConnectorJobSchema, 204: None},
    summary="Claim the next local model job",
)
def claim_connector_job(request, connector_id: UUID):
    connector = authenticate_connector(
        connector_id=connector_id,
        authorization=request.headers.get("Authorization"),
    )
    job = claim_next_job(connector=connector)
    return Status(200, job) if job is not None else Status(204, None)


@router.post(
    "/connectors/{connector_id}/jobs/{run_id}",
    auth=None,
    response=WorkflowRunSchema,
    summary="Complete a local model job",
)
def complete_connector_job(
    request,
    connector_id: UUID,
    run_id: UUID,
    payload: ConnectorJobResultInput,
):
    connector = authenticate_connector(
        connector_id=connector_id,
        authorization=request.headers.get("Authorization"),
    )
    return complete_job(
        connector=connector,
        run_id=run_id,
        output=payload.output,
        input_tokens=payload.inputTokens,
        output_tokens=payload.outputTokens,
        error_code=payload.errorCode,
    )
