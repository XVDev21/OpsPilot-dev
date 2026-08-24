from typing import Annotated, Literal

from ninja import Schema
from pydantic import Field, StringConstraints

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=160)]
MeaningfulText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=12, max_length=3_000)
]
LongText = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=20, max_length=12_000)
]
InputMode = Literal["simple", "advanced"]
OptionalShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)]
OptionalMeaningfulText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=3_000)]
CollaboratorId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        max_length=64,
        pattern=r"^[a-z0-9][a-z0-9-]{2,63}$",
    ),
]
OptionalCollaboratorId = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        max_length=64,
        pattern=r"^(?:|[a-z0-9][a-z0-9-]{2,63})$",
    ),
]


class EvidenceItem(Schema):
    value: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1_000)]


class BugTriageInput(Schema):
    inputMode: InputMode = "simple"
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    affectedArea: OptionalShortText = ""
    observedBehavior: MeaningfulText
    expectedBehavior: OptionalMeaningfulText = ""
    evidence: list[EvidenceItem] = Field(default_factory=list, max_length=12)
    settings: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2_000)] | None = (
        None
    )
    constraints: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2_000)] | None
    ) = None
    triageOwnerId: OptionalCollaboratorId = ""


class RoutingRecommendation(Schema):
    team: Literal["operations", "support", "engineering"]
    ownerId: CollaboratorId | None
    rationale: str


class BugTriageOutput(Schema):
    summary: str
    confirmedFacts: list[str]
    contradictingEvidence: list[str] = Field(default_factory=list)
    evidenceGaps: list[str]
    likelyCategory: str
    issueType: Literal["product-defect", "configuration-or-process", "needs-more-evidence"]
    routing: RoutingRecommendation
    recommendedChecks: list[str]
    recommendedResolution: str = ""
    verificationSteps: list[str] = Field(default_factory=list)
    confidence: float = Field(ge=0, le=1)
    humanReviewNotice: str
    humanReviewRequired: bool = True


class Participant(Schema):
    value: ShortText


class MeetingActionsInput(Schema):
    inputMode: InputMode = "simple"
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    notes: LongText
    participants: list[Participant] = Field(default_factory=list, max_length=50)
    date: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None
    coordinatorId: OptionalCollaboratorId = ""


class ActionItem(Schema):
    task: str
    owner: str | None
    deadline: str | None


class MeetingActionsOutput(Schema):
    summary: str
    followUpCoordinatorId: CollaboratorId | None
    decisions: list[str]
    actionItems: list[ActionItem]
    openQuestions: list[str]
    unresolvedItems: list[str]


class StatusUpdateInput(Schema):
    inputMode: InputMode = "simple"
    notes: LongText
    audience: Literal["team", "manager", "stakeholders"]
    format: Literal["daily", "manager", "technical"]
    authorId: OptionalCollaboratorId = ""


class StatusUpdateOutput(Schema):
    authorId: CollaboratorId | None
    completed: list[str]
    inProgress: list[str]
    blocked: list[str]
    nextSteps: list[str]
    shareableUpdate: str


class WorkflowMetadata(Schema):
    id: Literal["bug-triage", "meeting-actions", "status-update"]
    title: str
    shortTitle: str
    category: Literal["Technical", "Collaboration", "Operations"]
    description: str
    benefit: str
    promptVersion: str


class ProviderOption(Schema):
    id: Literal["gemini", "openai", "qwen", "bedrock", "custom", "local"]
    label: str
    description: str
    enabled: bool
    credentialSource: Literal["personal", "platform", "connector"] | None
    supportsPersonalKey: bool
    supportsImages: bool
    models: dict[Literal["fast", "balanced", "high"], str | None]


class IntelligenceOption(Schema):
    id: Literal["fast", "balanced", "high"]
    label: str
    description: str
    relativeUsage: Literal["lowest", "medium", "highest"]


class ExecutionOptions(Schema):
    providers: list[ProviderOption]
    intelligenceLevels: list[IntelligenceOption]
    defaultProvider: Literal["gemini", "openai", "qwen", "bedrock", "custom", "local"]
    defaultIntelligence: Literal["fast", "balanced", "high"]
    retentionDays: int
