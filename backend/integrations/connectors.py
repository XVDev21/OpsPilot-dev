import hashlib
import hmac
import secrets
from datetime import timedelta
from uuid import UUID

from django.db import transaction
from django.utils import timezone

from accounts.models import AppUser
from common.errors import OpsPilotError
from integrations.models import LocalConnector

PAIRING_TTL = timedelta(minutes=10)
ONLINE_WINDOW = timedelta(seconds=90)


def _digest(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def connector_summary(connector: LocalConnector) -> dict:
    now = timezone.now()
    return {
        "id": connector.id,
        "name": connector.name,
        "paired": bool(connector.token_digest and connector.paired_at),
        "online": bool(connector.last_seen_at and connector.last_seen_at >= now - ONLINE_WINDOW),
        "modelFast": connector.model_fast,
        "modelBalanced": connector.model_balanced,
        "modelHigh": connector.model_high,
        "pairedAt": connector.paired_at,
        "lastSeenAt": connector.last_seen_at,
        "updatedAt": connector.updated_at,
    }


def connector_for_user(user: AppUser) -> LocalConnector | None:
    return LocalConnector.objects.filter(user=user).first()


@transaction.atomic
def create_pairing(
    *,
    user: AppUser,
    name: str,
    model_fast: str,
    model_balanced: str,
    model_high: str,
) -> tuple[LocalConnector, str]:
    pairing_code = secrets.token_urlsafe(24)
    expires_at = timezone.now() + PAIRING_TTL
    connector, _ = LocalConnector.objects.update_or_create(
        user=user,
        defaults={
            "name": name,
            "pairing_code_digest": _digest(pairing_code),
            "pairing_expires_at": expires_at,
            "model_fast": model_fast,
            "model_balanced": model_balanced,
            "model_high": model_high,
        },
    )
    return connector, pairing_code


@transaction.atomic
def redeem_pairing(*, connector_id: UUID, pairing_code: str) -> tuple[LocalConnector, str]:
    connector = LocalConnector.objects.select_for_update().filter(id=connector_id).first()
    now = timezone.now()
    if (
        connector is None
        or not connector.pairing_code_digest
        or not connector.pairing_expires_at
        or connector.pairing_expires_at < now
        or not hmac.compare_digest(connector.pairing_code_digest, _digest(pairing_code))
    ):
        raise OpsPilotError(
            code="INVALID_CONNECTOR_PAIRING",
            message="That connector pairing code is invalid or expired.",
            status=401,
        )
    token = secrets.token_urlsafe(48)
    connector.token_digest = _digest(token)
    connector.pairing_code_digest = ""
    connector.pairing_expires_at = None
    connector.paired_at = now
    connector.last_seen_at = now
    connector.save(
        update_fields=[
            "token_digest",
            "pairing_code_digest",
            "pairing_expires_at",
            "paired_at",
            "last_seen_at",
            "updated_at",
        ]
    )
    return connector, token


def authenticate_connector(*, connector_id: UUID, authorization: str | None) -> LocalConnector:
    prefix = "Bearer "
    if not authorization or not authorization.startswith(prefix):
        raise _connector_auth_error()
    token = authorization[len(prefix) :].strip()
    connector = LocalConnector.objects.filter(id=connector_id).first()
    if (
        connector is None
        or not connector.token_digest
        or not hmac.compare_digest(connector.token_digest, _digest(token))
    ):
        raise _connector_auth_error()
    LocalConnector.objects.filter(id=connector.id).update(last_seen_at=timezone.now())
    connector.refresh_from_db(fields=["last_seen_at"])
    return connector


def delete_connector(*, user: AppUser, connector_id: UUID) -> None:
    connector = LocalConnector.objects.filter(user=user, id=connector_id).first()
    if connector is not None:
        from runs.models import LocalConnectorJob, WorkflowRun

        run_ids = LocalConnectorJob.objects.filter(
            connector=connector,
            status__in=[LocalConnectorJob.Status.QUEUED, LocalConnectorJob.Status.LEASED],
        ).values_list("run_id", flat=True)
        WorkflowRun.objects.filter(id__in=run_ids, status=WorkflowRun.Status.PENDING).update(
            status=WorkflowRun.Status.FAILED,
            execution_phase=WorkflowRun.ExecutionPhase.FAILED,
            error_code="LOCAL_CONNECTOR_DISCONNECTED",
            completed_at=timezone.now(),
        )
    deleted, _ = LocalConnector.objects.filter(user=user, id=connector_id).delete()
    if not deleted:
        raise OpsPilotError(
            code="NOT_FOUND",
            message="That local connector was not found.",
            status=404,
        )


def _connector_auth_error() -> OpsPilotError:
    return OpsPilotError(
        code="INVALID_CONNECTOR_TOKEN",
        message="The local connector could not be authenticated.",
        status=401,
    )
