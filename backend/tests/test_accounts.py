from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from accounts.models import AppUser
from accounts.services import get_or_sync_app_user

pytestmark = pytest.mark.django_db


def test_me_creates_and_serializes_local_user(authenticated_client: Client) -> None:
    response = authenticated_client.get("/api/v1/me")

    assert response.status_code == 200
    assert response.json() == {
        "id": str(AppUser.objects.get().id),
        "workos_user_id": "user_test_primary",
        "email": "pilot@example.com",
        "display_name": "Pilot User",
        "avatar_url": "https://example.com/avatar.png",
    }


def test_user_mapping_is_idempotent_and_does_not_erase_profile() -> None:
    user = get_or_sync_app_user(
        {
            "sub": "user_test_idempotent",
            "email": "first@example.com",
            "name": "First Name",
        }
    )
    user.last_seen_at = timezone.now() - timedelta(minutes=10)
    user.save(update_fields=["last_seen_at"])

    same_user = get_or_sync_app_user({"sub": "user_test_idempotent"})

    assert same_user.id == user.id
    assert same_user.email == "first@example.com"
    assert same_user.display_name == "First Name"
    assert AppUser.objects.count() == 1
