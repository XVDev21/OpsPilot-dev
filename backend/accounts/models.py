import uuid

from django.db import models


class AppUser(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workos_user_id = models.CharField(max_length=255, unique=True)
    email = models.EmailField(blank=True, null=True)
    display_name = models.CharField(max_length=255, blank=True, null=True)
    avatar_url = models.URLField(max_length=2048, blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "app_users"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return self.email or self.workos_user_id
