from datetime import datetime
from typing import Annotated, Literal

from ninja import Schema
from pydantic import Field, StringConstraints

ProviderName = Literal["gemini", "openai", "qwen"]
EndpointRegion = Literal["singapore", "us", "beijing"]


class ProviderCredentialInput(Schema):
    apiKey: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=16, max_length=2_048),
    ]
    endpointRegion: EndpointRegion | None = None
    workspaceId: (
        Annotated[
            str,
            StringConstraints(
                strip_whitespace=True,
                min_length=2,
                max_length=63,
                pattern=r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])$",
            ),
        ]
        | None
    ) = None


class ProviderCredentialSummary(Schema):
    provider: ProviderName
    configured: bool
    keyFingerprint: str | None = None
    endpointRegion: EndpointRegion | None = None
    workspaceId: str | None = None
    updatedAt: datetime | None = None


class ProviderCredentialList(Schema):
    items: list[ProviderCredentialSummary] = Field(default_factory=list)
