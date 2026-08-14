from uuid import UUID

from ninja import ModelSchema

from accounts.models import AppUser


class AppUserSchema(ModelSchema):
    id: UUID

    class Meta:
        model = AppUser
        fields = ["id", "workos_user_id", "email", "display_name", "avatar_url"]
