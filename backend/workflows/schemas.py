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


class EvidenceItem(Schema):
    value: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=1_000)]


class BugTriageInput(Schema):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    affectedArea: ShortText
    observedBehavior: MeaningfulText
    expectedBehavior: MeaningfulText
    evidence: list[EvidenceItem] = Field(min_length=1, max_length=12)
    settings: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2_000)] | None = (
        None
    )
    constraints: (
        Annotated[str, StringConstraints(strip_whitespace=True, max_length=2_000)] | None
    ) = None


class BugTriageOutput(Schema):
    summary: str
    confirmedFacts: list[str]
    evidenceGaps: list[str]
    likelyCategory: str
    recommendedChecks: list[str]
    confidence: float = Field(ge=0, le=1)
    humanReviewNotice: str


class Participant(Schema):
    value: ShortText


class MeetingActionsInput(Schema):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    notes: LongText
    participants: list[Participant] = Field(max_length=50)
    date: Annotated[str, StringConstraints(strip_whitespace=True, max_length=50)] | None = None


class ActionItem(Schema):
    task: str
    owner: str | None
    deadline: str | None


class MeetingActionsOutput(Schema):
    summary: str
    decisions: list[str]
    actionItems: list[ActionItem]
    openQuestions: list[str]
    unresolvedItems: list[str]


class StatusUpdateInput(Schema):
    notes: LongText
    audience: Literal["team", "manager", "stakeholders"]
    format: Literal["daily", "manager", "technical"]


class StatusUpdateOutput(Schema):
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
    id: Literal["gemini", "openai", "qwen"]
    label: str
    description: str
    enabled: bool
    credentialSource: Literal["personal", "platform"] | None
    supportsPersonalKey: bool


class IntelligenceOption(Schema):
    id: Literal["fast", "balanced", "high"]
    label: str
    description: str
    relativeUsage: Literal["lowest", "medium", "highest"]


class ExecutionOptions(Schema):
    providers: list[ProviderOption]
    intelligenceLevels: list[IntelligenceOption]
    defaultProvider: Literal["gemini", "openai", "qwen"]
    defaultIntelligence: Literal["fast", "balanced", "high"]
    retentionDays: int
