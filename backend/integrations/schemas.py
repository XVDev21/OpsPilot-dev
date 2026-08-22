from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from ninja import Schema
from pydantic import Field, StringConstraints

ProviderName = Literal["gemini", "openai", "qwen", "bedrock", "custom"]
EndpointRegion = Literal["singapore", "us", "beijing"]
AwsRegion = Literal[
    "us-east-1",
    "us-east-2",
    "us-west-2",
    "ap-northeast-1",
    "ap-south-1",
    "ap-southeast-1",
    "ap-southeast-2",
    "eu-central-1",
    "eu-west-1",
    "eu-west-2",
]
ModelId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        min_length=2,
        max_length=256,
        pattern=r"^[A-Za-z0-9][A-Za-z0-9._:/-]{1,255}$",
    ),
]


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
    displayName: Annotated[str, StringConstraints(strip_whitespace=True, max_length=80)] | None = (
        None
    )
    baseUrl: Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)] | None = None
    awsRegion: AwsRegion | None = None
    modelFast: ModelId | None = None
    modelBalanced: ModelId | None = None
    modelHigh: ModelId | None = None


class ProviderCredentialSummary(Schema):
    provider: ProviderName
    configured: bool
    keyFingerprint: str | None = None
    endpointRegion: EndpointRegion | None = None
    workspaceId: str | None = None
    displayName: str | None = None
    baseUrl: str | None = None
    awsRegion: str | None = None
    modelFast: str | None = None
    modelBalanced: str | None = None
    modelHigh: str | None = None
    updatedAt: datetime | None = None


class ProviderCredentialList(Schema):
    items: list[ProviderCredentialSummary] = Field(default_factory=list)


class LocalConnectorPairingInput(Schema):
    name: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    modelFast: ModelId
    modelBalanced: ModelId
    modelHigh: ModelId


class LocalConnectorSummary(Schema):
    id: UUID
    name: str
    paired: bool
    online: bool
    modelFast: str
    modelBalanced: str
    modelHigh: str
    pairedAt: datetime | None = None
    lastSeenAt: datetime | None = None
    updatedAt: datetime


class LocalConnectorPairing(Schema):
    connector: LocalConnectorSummary
    pairingCode: str
    expiresAt: datetime


class LocalConnectorEnvelope(Schema):
    connector: LocalConnectorSummary | None = None


class ConnectorPairInput(Schema):
    connectorId: UUID
    pairingCode: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=16, max_length=128),
    ]


class ConnectorPairResult(Schema):
    connectorId: UUID
    connectorToken: str


class ConnectorJobSchema(Schema):
    runId: UUID
    workflowId: Literal["bug-triage", "meeting-actions", "status-update"]
    model: str
    systemInstruction: str
    userContent: str
    outputSchema: dict
    maxOutputTokens: int


class ConnectorJobResultInput(Schema):
    output: dict | None = None
    inputTokens: int | None = Field(default=None, ge=0)
    outputTokens: int | None = Field(default=None, ge=0)
    errorCode: (
        Literal["AI_AUTH_ERROR", "AI_TIMEOUT", "AI_UNAVAILABLE", "INVALID_AI_OUTPUT"] | None
    ) = None
