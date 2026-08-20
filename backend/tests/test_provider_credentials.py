import pytest
from django.test import Client, override_settings

from accounts.models import AppUser
from integrations.models import ProviderCredential
from integrations.services import personal_credential_for_user, save_provider_credential

pytestmark = pytest.mark.django_db

ENCRYPTION_KEY = "test-provider-credential-secret-that-is-long-enough"
ROTATED_KEY = "rotated-provider-credential-secret-that-is-long-enough"


@override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY])
def test_personal_credentials_are_encrypted_masked_and_rotatable(
    authenticated_client: Client,
) -> None:
    response = authenticated_client.put(
        "/api/v1/provider-credentials/openai",
        data={"apiKey": "sk-user-owned-openai-key"},
        content_type="application/json",
    )

    assert response.status_code == 200
    assert response.json()["configured"] is True
    assert "apiKey" not in response.json()
    credential = ProviderCredential.objects.get(provider="openai")
    assert "sk-user-owned-openai-key" not in credential.encrypted_api_key
    assert len(credential.key_fingerprint) == 12

    rotated = authenticated_client.put(
        "/api/v1/provider-credentials/openai",
        data={"apiKey": "sk-user-owned-openai-key-rotated"},
        content_type="application/json",
    )
    assert rotated.status_code == 200
    assert ProviderCredential.objects.filter(provider="openai").count() == 1
    resolved = personal_credential_for_user(
        user=AppUser.objects.get(workos_user_id="user_test_primary"),
        provider="openai",
    )
    assert resolved is not None
    assert resolved.api_key == "sk-user-owned-openai-key-rotated"


def test_encryption_key_rotation_keeps_existing_credentials_readable() -> None:
    user = AppUser.objects.create(workos_user_id="rotation-user")
    with override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY]):
        save_provider_credential(
            user=user,
            provider="gemini",
            api_key="user-gemini-key-that-is-long-enough",
            endpoint_region=None,
            workspace_id=None,
        )

    with override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ROTATED_KEY, ENCRYPTION_KEY]):
        credential = personal_credential_for_user(user=user, provider="gemini")

    assert credential is not None
    assert credential.api_key == "user-gemini-key-that-is-long-enough"


@override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY])
def test_credential_status_and_delete_are_scoped_to_authenticated_user(
    authenticated_client: Client,
) -> None:
    authenticated_client.put(
        "/api/v1/provider-credentials/gemini",
        data={"apiKey": "user-gemini-key-that-is-long-enough"},
        content_type="application/json",
    )

    listed = authenticated_client.get("/api/v1/provider-credentials")
    assert listed.status_code == 200
    by_provider = {item["provider"]: item for item in listed.json()["items"]}
    assert by_provider["gemini"]["configured"] is True
    assert by_provider["openai"]["configured"] is False
    assert by_provider["qwen"]["configured"] is False

    deleted = authenticated_client.delete("/api/v1/provider-credentials/gemini")
    assert deleted.status_code == 204
    assert ProviderCredential.objects.count() == 0


@override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY])
def test_credentials_cannot_be_listed_or_deleted_across_users(
    authenticated_client: Client,
) -> None:
    other_user = AppUser.objects.create(workos_user_id="other-provider-user")
    save_provider_credential(
        user=other_user,
        provider="openai",
        api_key="sk-other-user-openai-key-that-is-long-enough",
        endpoint_region=None,
        workspace_id=None,
    )

    listed = authenticated_client.get("/api/v1/provider-credentials")
    by_provider = {item["provider"]: item for item in listed.json()["items"]}
    deleted = authenticated_client.delete("/api/v1/provider-credentials/openai")

    assert by_provider["openai"]["configured"] is False
    assert deleted.status_code == 204
    assert ProviderCredential.objects.filter(user=other_user, provider="openai").exists()


@override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[ENCRYPTION_KEY])
def test_qwen_requires_a_vetted_region_and_workspace(
    authenticated_client: Client,
) -> None:
    missing_workspace = authenticated_client.put(
        "/api/v1/provider-credentials/qwen",
        data={"apiKey": "qwen-user-key-that-is-long-enough", "endpointRegion": "singapore"},
        content_type="application/json",
    )
    unsafe_workspace = authenticated_client.put(
        "/api/v1/provider-credentials/qwen",
        data={
            "apiKey": "qwen-user-key-that-is-long-enough",
            "endpointRegion": "singapore",
            "workspaceId": "evil.example.com",
        },
        content_type="application/json",
    )
    valid = authenticated_client.put(
        "/api/v1/provider-credentials/qwen",
        data={
            "apiKey": "qwen-user-key-that-is-long-enough",
            "endpointRegion": "singapore",
            "workspaceId": "ws-opspilot-01",
        },
        content_type="application/json",
    )

    assert missing_workspace.status_code == 422
    assert missing_workspace.json()["error"]["fieldErrors"]["workspaceId"]
    assert unsafe_workspace.status_code == 422
    assert unsafe_workspace.json()["error"]["code"] == "VALIDATION_ERROR"
    assert valid.status_code == 200
    assert valid.json()["workspaceId"] == "ws-opspilot-01"


def test_missing_encryption_configuration_fails_closed(authenticated_client: Client) -> None:
    with override_settings(PROVIDER_CREDENTIAL_ENCRYPTION_KEYS=[]):
        response = authenticated_client.put(
            "/api/v1/provider-credentials/gemini",
            data={"apiKey": "user-gemini-key-that-is-long-enough"},
            content_type="application/json",
        )

    assert response.status_code == 503
    assert response.json()["error"]["code"] == "CREDENTIAL_STORAGE_UNAVAILABLE"


def test_credentials_require_authentication(client: Client) -> None:
    response = client.get("/api/v1/provider-credentials")
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "AUTH_REQUIRED"
