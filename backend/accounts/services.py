from collections.abc import Mapping
from datetime import timedelta
from typing import Any

from django.db import transaction
from django.utils import timezone

from accounts.models import AppUser


def optional_text(claims: Mapping[str, Any], *names: str) -> str | None:
    for name in names:
        value = claims.get(name)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


@transaction.atomic
def get_or_sync_app_user(claims: Mapping[str, Any]) -> AppUser:
    workos_user_id = str(claims["sub"])
    user, _ = AppUser.objects.select_for_update().get_or_create(workos_user_id=workos_user_id)

    changes: dict[str, str | None] = {
        "email": optional_text(claims, "email"),
        "display_name": optional_text(claims, "name", "display_name"),
        "avatar_url": optional_text(claims, "picture", "avatar_url"),
    }
    update_fields: list[str] = []
    for field, value in changes.items():
        if value is not None and getattr(user, field) != value:
            setattr(user, field, value)
            update_fields.append(field)

    now = timezone.now()
    if user.last_seen_at is None or user.last_seen_at < now - timedelta(minutes=5):
        user.last_seen_at = now
        update_fields.append("last_seen_at")

    if update_fields:
        user.save(update_fields=[*update_fields, "updated_at"])
    return user
