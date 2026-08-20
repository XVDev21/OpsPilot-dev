from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa

from common.auth import WorkOSTokenVerifier


@pytest.fixture
def verifier_and_key(monkeypatch: pytest.MonkeyPatch):
    private_key = rsa.generate_private_key(public_exponent=65_537, key_size=2048)
    verifier = WorkOSTokenVerifier(
        client_id="client_test_opspilot",
        issuer="https://api.workos.com/",
        jwks_url="https://example.invalid/jwks",
        cache_seconds=300,
    )
    monkeypatch.setattr(
        verifier.jwks_client,
        "get_signing_key_from_jwt",
        lambda token: SimpleNamespace(key=private_key.public_key()),
    )
    return verifier, private_key


def signed_token(private_key, **overrides) -> str:
    now = datetime.now(UTC)
    claims = {
        "iss": "https://api.workos.com/",
        "sub": "user_test_signed",
        "client_id": "client_test_opspilot",
        "iat": now,
        "exp": now + timedelta(minutes=5),
        **overrides,
    }
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "test-key"})


def test_verifier_accepts_valid_rsa_signed_workos_token(verifier_and_key) -> None:
    verifier, private_key = verifier_and_key

    claims = verifier.verify(signed_token(private_key))

    assert claims["sub"] == "user_test_signed"
    assert claims["client_id"] == "client_test_opspilot"


def test_verifier_rejects_same_host_with_non_matching_issuer_path(verifier_and_key) -> None:
    verifier, private_key = verifier_and_key

    with pytest.raises(jwt.InvalidIssuerError):
        verifier.verify(signed_token(private_key, iss="https://api.workos.com"))


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"client_id": "client_other"}, "client_id"),
        ({"iss": "https://issuer.invalid"}, "issuer"),
        ({"sub": "service_not_a_user"}, "subject"),
        ({"exp": datetime.now(UTC) - timedelta(minutes=1)}, "expired"),
    ],
)
def test_verifier_rejects_invalid_claims(verifier_and_key, overrides, message) -> None:
    verifier, private_key = verifier_and_key

    with pytest.raises(jwt.PyJWTError, match=message):
        verifier.verify(signed_token(private_key, **overrides))
