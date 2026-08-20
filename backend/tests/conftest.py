from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

import jwt
import pytest
from django.test import Client


@pytest.fixture
def client() -> Client:
    return Client()


@pytest.fixture
def workos_claims() -> dict[str, Any]:
    return {
        "iss": "https://api.workos.com/",
        "sub": "user_test_primary",
        "client_id": "client_test_opspilot",
        "email": "pilot@example.com",
        "name": "Pilot User",
        "picture": "https://example.com/avatar.png",
        "iat": 1_786_694_400,
        "exp": 1_786_698_000,
    }


@dataclass
class StubVerifier:
    claims: dict[str, Any]
    accepted_token: str = "valid-test-token"

    def verify(self, token: str) -> dict[str, Any]:
        if token != self.accepted_token:
            raise jwt.InvalidTokenError("invalid test token")
        return self.claims


@pytest.fixture
def authenticated_client(
    client: Client,
    monkeypatch: pytest.MonkeyPatch,
    workos_claims: dict[str, Any],
) -> Iterator[Client]:
    verifier = StubVerifier(workos_claims)
    monkeypatch.setattr("common.auth.get_token_verifier", lambda: verifier)
    client.defaults["HTTP_AUTHORIZATION"] = "Bearer valid-test-token"
    yield client
