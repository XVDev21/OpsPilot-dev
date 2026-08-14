from typing import Annotated, Literal

from ninja import Schema
from pydantic import Field, StringConstraints

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=2)]
MeaningfulText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=12)]
LongText = Annotated[str, StringConstraints(strip_whitespace=True, min_length=20)]


class EvidenceItem(Schema):
    value: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3)]


class BugTriageInput(Schema):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3)]
    affectedArea: ShortText
    observedBehavior: MeaningfulText
    expectedBehavior: MeaningfulText
    evidence: list[EvidenceItem] = Field(min_length=1)
    settings: str | None = None
    constraints: str | None = None


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
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3)]
    notes: LongText
    participants: list[Participant]
    date: str | None = None


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
