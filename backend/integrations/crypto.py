import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken, MultiFernet
from django.conf import settings


class CredentialEncryptionUnavailable(Exception):
    """Raised when credential encryption is missing or ciphertext cannot be decrypted."""


def _cipher() -> MultiFernet:
    secrets = tuple(settings.PROVIDER_CREDENTIAL_ENCRYPTION_KEYS)
    if not secrets or any(len(secret) < 32 for secret in secrets):
        raise CredentialEncryptionUnavailable
    fernets = [
        Fernet(base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest()))
        for secret in secrets
    ]
    return MultiFernet(fernets)


def encrypt_api_key(api_key: str) -> str:
    return _cipher().encrypt(api_key.encode("utf-8")).decode("ascii")


def decrypt_api_key(ciphertext: str) -> str:
    try:
        return _cipher().decrypt(ciphertext.encode("ascii")).decode("utf-8")
    except (InvalidToken, UnicodeDecodeError, ValueError) as exc:
        raise CredentialEncryptionUnavailable from exc
