import logging
import secrets
from collections.abc import Mapping
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

import jwt
from django.conf import settings
from ninja.security import HttpBearer

from accounts.models import AppUser
from accounts.services import get_or_sync_app_user
from common.errors import OpsPilotError

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class WorkOSPrincipal:
    user: AppUser
    claims: Mapping[str, Any]
    workspace_id: str
    organization_id: str | None


class WorkOSTokenVerifier:
    def __init__(
        self,
        *,
        client_id: str,
        issuer: str,
        jwks_url: str,
        cache_seconds: int,
    ) -> None:
        self.client_id = client_id
        self.issuer = issuer
        self.jwks_url = jwks_url
        self.jwks_client = jwt.PyJWKClient(
            jwks_url,
            cache_keys=True,
            lifespan=cache_seconds,
            timeout=5,
        )

    def verify(self, token: str) -> dict[str, Any]:
        signing_key = self.jwks_client.get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=self.issuer,
            options={"require": ["exp", "iat", "iss", "sub", "client_id"]},
            leeway=30,
        )
        token_client_id = claims.get("client_id")
        if not isinstance(token_client_id, str) or not secrets.compare_digest(
            token_client_id, self.client_id
        ):
            raise jwt.InvalidTokenError("Token client_id does not match this application.")
        subject = claims.get("sub")
        if not isinstance(subject, str) or not subject.startswith("user_"):
            raise jwt.InvalidTokenError("Token subject is not a WorkOS user.")
        return claims


@lru_cache(maxsize=1)
def get_token_verifier() -> WorkOSTokenVerifier:
    client_id = settings.WORKOS_CLIENT_ID.strip()
    if not client_id:
        raise OpsPilotError(
            code="AUTH_UNAVAILABLE",
            message="Authentication is not configured for this environment.",
            status=503,
            retryable=False,
        )
    jwks_url = settings.WORKOS_JWKS_URL.strip() or (f"https://api.workos.com/sso/jwks/{client_id}")
    return WorkOSTokenVerifier(
        client_id=client_id,
        issuer=settings.WORKOS_ISSUER,
        jwks_url=jwks_url,
        cache_seconds=settings.WORKOS_JWKS_CACHE_SECONDS,
    )


class WorkOSBearer(HttpBearer):
    def authenticate(self, request, token: str) -> WorkOSPrincipal:
        try:
            claims = get_token_verifier().verify(token)
        except OpsPilotError:
            raise
        except jwt.PyJWKClientConnectionError as exc:
            logger.warning("WorkOS JWKS could not be reached reason=%s", type(exc).__name__)
            raise OpsPilotError(
                code="AUTH_UNAVAILABLE",
                message="Authentication is temporarily unavailable.",
                status=503,
                retryable=True,
            ) from exc
        except jwt.PyJWTError as exc:
            logger.info("WorkOS access token rejected reason=%s", type(exc).__name__)
            raise OpsPilotError(
                code="INVALID_TOKEN",
                message="The access token is invalid or expired.",
                status=401,
            ) from exc

        user = get_or_sync_app_user(claims)
        from cases.collaboration import bind_authenticated_workspace

        workspace = bind_authenticated_workspace(user, claims)
        organization_id = claims.get("org_id")
        principal = WorkOSPrincipal(
            user=user,
            claims=claims,
            workspace_id=str(workspace.id),
            organization_id=organization_id if isinstance(organization_id, str) else None,
        )
        request.app_user = user
        request.workos_claims = claims
        return principal


workos_bearer = WorkOSBearer()
