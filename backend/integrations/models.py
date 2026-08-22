import uuid

from django.db import models

from accounts.models import AppUser


class ProviderCredential(models.Model):
    class Provider(models.TextChoices):
        GEMINI = "gemini", "Gemini"
        OPENAI = "openai", "OpenAI"
        QWEN = "qwen", "Qwen"
        BEDROCK = "bedrock", "Amazon Bedrock"
        CUSTOM = "custom", "OpenAI-compatible"

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
    display_name = models.CharField(max_length=80, blank=True)
    base_url = models.URLField(max_length=500, blank=True)
    aws_region = models.CharField(max_length=32, blank=True)
    model_fast = models.CharField(max_length=256, blank=True)
    model_balanced = models.CharField(max_length=256, blank=True)
    model_high = models.CharField(max_length=256, blank=True)
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


class LocalConnector(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(
        AppUser,
        on_delete=models.CASCADE,
        related_name="local_connector",
    )
    name = models.CharField(max_length=80)
    token_digest = models.CharField(max_length=64, blank=True)
    pairing_code_digest = models.CharField(max_length=64, blank=True)
    pairing_expires_at = models.DateTimeField(blank=True, null=True)
    paired_at = models.DateTimeField(blank=True, null=True)
    last_seen_at = models.DateTimeField(blank=True, null=True)
    model_fast = models.CharField(max_length=256)
    model_balanced = models.CharField(max_length=256)
    model_high = models.CharField(max_length=256)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "local_connectors"
        ordering = ["name"]

    def __str__(self) -> str:
        return f"{self.user_id}:{self.name}"
