import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any

import workos
from django.conf import settings
from workos import WorkOSClient

from common.errors import OpsPilotError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class DirectoryOrganization:
    id: str
    name: str


@dataclass(frozen=True)
class DirectoryInvitation:
    id: str
    email: str
    state: str
    organization_id: str | None
    accepted_user_id: str | None
    accepted_at: datetime | None
    revoked_at: datetime | None
    expires_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class DirectoryMembership:
    id: str
    user_id: str
    organization_id: str
    status: str
    email: str | None
    name: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class DirectoryUser:
    id: str
    email: str | None
    name: str


def _enum_value(value: Any) -> str:
    return str(value.value if isinstance(value, Enum) else getattr(value, "value", value))


def _display_name(user: Any) -> str:
    first_name = (getattr(user, "first_name", None) or "").strip()
    last_name = (getattr(user, "last_name", None) or "").strip()
    return " ".join(part for part in (first_name, last_name) if part)


def _translate_error(exc: Exception, *, operation: str) -> OpsPilotError:
    logger.warning(
        "WorkOS directory operation failed operation=%s reason=%s", operation, type(exc).__name__
    )
    if isinstance(exc, workos.RateLimitExceededError):
        return OpsPilotError(
            code="WORKOS_RATE_LIMITED",
            message="The identity provider is busy. Try this collaboration change again shortly.",
            status=503,
            retryable=True,
        )
    if isinstance(exc, (workos.AuthenticationError, workos.AuthorizationError)):
        return OpsPilotError(
            code="COLLABORATION_CONFIGURATION_INVALID",
            message="Workspace collaboration is not configured correctly for this environment.",
            status=503,
            retryable=False,
        )
    if isinstance(exc, workos.ConflictError):
        return OpsPilotError(
            code="WORKOS_CONFLICT",
            message="That collaboration change conflicts with an existing identity record.",
            status=409,
            retryable=False,
        )
    return OpsPilotError(
        code="WORKOS_UNAVAILABLE",
        message="Workspace collaboration is temporarily unavailable.",
        status=503,
        retryable=True,
    )


class WorkOSDirectory:
    def __init__(self, client: WorkOSClient):
        self.client = client

    def create_organization(self, *, name: str, external_id: str) -> DirectoryOrganization:
        try:
            organization = self.client.organizations.create_organization(
                name=name,
                external_id=external_id,
                metadata={"managed_by": "opspilot"},
            )
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="create_organization") from exc
        return DirectoryOrganization(id=organization.id, name=organization.name)

    def create_membership(self, *, organization_id: str, user_id: str) -> DirectoryMembership:
        try:
            membership = self.client.organization_membership.create_organization_membership(
                organization_id=organization_id,
                user_id=user_id,
            )
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="create_membership") from exc
        return self._membership(membership)

    def send_invitation(
        self,
        *,
        organization_id: str,
        email: str,
        inviter_user_id: str,
        expires_in_days: int,
    ) -> DirectoryInvitation:
        try:
            invitation = self.client.user_management.send_invitation(
                organization_id=organization_id,
                email=email,
                inviter_user_id=inviter_user_id,
                expires_in_days=expires_in_days,
            )
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="send_invitation") from exc
        return self._invitation(invitation)

    def revoke_invitation(self, invitation_id: str) -> DirectoryInvitation:
        try:
            invitation = self.client.user_management.revoke_invitation(invitation_id)
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="revoke_invitation") from exc
        return self._invitation(invitation)

    def list_invitations(self, *, organization_id: str) -> list[DirectoryInvitation]:
        try:
            page = self.client.user_management.list_invitations(
                organization_id=organization_id,
                limit=100,
            )
            return [self._invitation(item) for item in page]
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="list_invitations") from exc

    def list_memberships(self, *, organization_id: str) -> list[DirectoryMembership]:
        try:
            page = self.client.organization_membership.list_organization_memberships(
                organization_id=organization_id,
                limit=100,
            )
            return [self._membership(item) for item in page]
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="list_memberships") from exc

    def deactivate_membership(self, membership_id: str) -> DirectoryMembership:
        try:
            membership = self.client.organization_membership.deactivate_organization_membership(
                membership_id
            )
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="deactivate_membership") from exc
        return self._membership(membership)

    def get_user(self, user_id: str) -> DirectoryUser:
        try:
            user = self.client.user_management.get_user(user_id)
        except workos.WorkOSError as exc:
            raise _translate_error(exc, operation="get_user") from exc
        return DirectoryUser(
            id=user.id,
            email=(user.email or "").strip().lower() or None,
            name=_display_name(user),
        )

    def verify_webhook(self, *, body: bytes, signature: str):
        secret = settings.WORKOS_WEBHOOK_SECRET
        if not secret:
            raise OpsPilotError(
                code="WORKOS_WEBHOOK_UNAVAILABLE",
                message="The WorkOS webhook secret is not configured.",
                status=503,
                retryable=False,
            )
        try:
            return self.client.webhooks.verify_event(
                event_body=body,
                event_signature=signature,
                secret=secret,
            )
        except Exception as exc:
            logger.info("WorkOS webhook rejected reason=%s", type(exc).__name__)
            raise OpsPilotError(
                code="INVALID_WORKOS_SIGNATURE",
                message="The WorkOS webhook signature is invalid.",
                status=401,
                retryable=False,
            ) from exc

    @staticmethod
    def _invitation(item: Any) -> DirectoryInvitation:
        return DirectoryInvitation(
            id=item.id,
            email=item.email.strip().lower(),
            state=_enum_value(item.state),
            organization_id=item.organization_id,
            accepted_user_id=item.accepted_user_id,
            accepted_at=item.accepted_at,
            revoked_at=item.revoked_at,
            expires_at=item.expires_at,
            updated_at=item.updated_at,
        )

    @staticmethod
    def _membership(item: Any) -> DirectoryMembership:
        user = getattr(item, "user", None)
        email = (getattr(user, "email", None) or "").strip().lower() or None
        return DirectoryMembership(
            id=item.id,
            user_id=item.user_id,
            organization_id=item.organization_id,
            status=_enum_value(item.status),
            email=email,
            name=_display_name(user),
            created_at=item.created_at,
            updated_at=item.updated_at,
        )


def get_workos_directory() -> WorkOSDirectory:
    if not settings.WORKOS_API_KEY:
        raise OpsPilotError(
            code="COLLABORATION_NOT_CONFIGURED",
            message="Workspace collaboration is not configured for this environment.",
            status=503,
            retryable=False,
        )
    return WorkOSDirectory(
        WorkOSClient(
            api_key=settings.WORKOS_API_KEY,
            client_id=settings.WORKOS_CLIENT_ID,
        )
    )
