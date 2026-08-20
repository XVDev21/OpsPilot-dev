from django.db import models

from accounts.models import AppUser


class ProviderCredential(models.Model):
    class Provider(models.TextChoices):
        GEMINI = "gemini", "Gemini"
        OPENAI = "openai", "OpenAI"
        QWEN = "qwen", "Qwen"

    class EndpointRegion(models.TextChoices):
        SINGAPORE = "singapore", "Singapore"
        US = "us", "US (Virginia)"
        BEIJING = "beijing", "China (Beijing)"

    user = models.ForeignKey(
        AppUser,
        on_delete=models.CASCADE,
        related_name="provider_credentials",
    )
    provider = models.CharField(max_length=32, choices=Provider.choices)
    encrypted_api_key = models.TextField()
    key_fingerprint = models.CharField(max_length=16)
    endpoint_region = models.CharField(
        max_length=32,
        choices=EndpointRegion.choices,
        blank=True,
    )
    workspace_id = models.CharField(max_length=63, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    last_used_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "provider_credentials"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "provider"],
                name="provider_credentials_user_provider_unique",
            )
        ]
        ordering = ["provider"]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.provider}"
