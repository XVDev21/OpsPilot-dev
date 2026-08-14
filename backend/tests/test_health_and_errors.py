from uuid import UUID

import jwt
import pytest
from django.test import Client

pytestmark = pytest.mark.django_db


def test_health_is_public_and_returns_request_id(client: Client) -> None:
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "opspilot-api",
        "version": "v1",
    }
    UUID(response.headers["X-Request-ID"])


def test_valid_request_id_is_preserved(client: Client) -> None:
    request_id = "7d7fc69a-b4e5-4eb1-a7be-63cbf9fc7bea"
    response = client.get("/api/v1/health", headers={"X-Request-ID": request_id})

    assert response.headers["X-Request-ID"] == request_id


def test_invalid_request_id_is_replaced(client: Client) -> None:
    response = client.get("/api/v1/health", headers={"X-Request-ID": "not-a-uuid"})

    assert response.headers["X-Request-ID"] != "not-a-uuid"
    UUID(response.headers["X-Request-ID"])


def test_missing_token_uses_stable_error_envelope(client: Client) -> None:
    response = client.get("/api/v1/me")

    assert response.status_code == 401
    payload = response.json()["error"]
    assert payload == {
        "code": "AUTH_REQUIRED",
        "message": "Sign in to access this resource.",
        "fieldErrors": {},
        "requestId": response.headers["X-Request-ID"],
        "retryable": False,
    }


def test_invalid_token_uses_stable_error_envelope(
    authenticated_client: Client,
) -> None:
    response = authenticated_client.get(
        "/api/v1/me", headers={"Authorization": "Bearer wrong-token"}
    )

    assert response.status_code == 401
    assert response.json()["error"]["code"] == "INVALID_TOKEN"
    assert response.json()["error"]["retryable"] is False


def test_jwks_outage_is_retryable_service_unavailable(
    client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class UnavailableVerifier:
        def verify(self, token: str) -> dict:
            raise jwt.PyJWKClientConnectionError("JWKS unavailable")

    monkeypatch.setattr("common.auth.get_token_verifier", lambda: UnavailableVerifier())

    response = client.get(
        "/api/v1/me", headers={"Authorization": "Bearer syntactically-valid-token"}
    )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "AUTH_UNAVAILABLE"
    assert response.json()["error"]["retryable"] is True


@pytest.mark.parametrize("page", [0, -1, 10_001])
def test_query_validation_uses_stable_error_envelope(
    authenticated_client: Client,
    page: int,
) -> None:
    response = authenticated_client.get("/api/v1/runs", {"page": page})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert response.json()["error"]["fieldErrors"]
