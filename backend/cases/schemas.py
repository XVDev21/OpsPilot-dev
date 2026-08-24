from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from ninja import Schema
from pydantic import Field, StringConstraints, model_validator

CaseStatus = Literal[
    "new",
    "triaging",
    "needs-information",
    "action-required",
    "in-progress",
    "monitoring",
    "resolved",
    "closed",
]
CaseDisposition = Literal[
    "unclassified",
    "product-defect",
    "configuration-change",
    "process-guidance",
    "external-dependency",
    "duplicate",
    "needs-more-evidence",
]
CaseIntent = Literal["issue", "clarification", "enhancement"]
CasePublicationState = Literal["draft", "published", "archived"]


class WorkspaceMemberSchema(Schema):
    id: UUID
    key: str
    name: str
    email: str | None
    initials: str
    role: str
    discipline: str
    focus: str
    availability: str
    workflowFit: list[str]
    tone: Literal["indigo", "cyan", "amber", "neutral"]
    isSample: bool
    linkedAccount: bool


class WorkspaceMemberList(Schema):
    items: list[WorkspaceMemberSchema]


class CaseSummarySchema(Schema):
    id: UUID
    key: str
    title: str
    summary: str
    intent: CaseIntent
    publicationState: CasePublicationState
    status: CaseStatus
    disposition: CaseDisposition
    confidence: float | None
    dueDate: date | None
    assignee: WorkspaceMemberSchema | None
    workItemCount: int
    completedWorkItemCount: int
    createdAt: datetime
    updatedAt: datetime


class CaseListResponse(Schema):
    items: list[CaseSummarySchema]
    page: int
    pageSize: int
    total: int
    hasMore: bool


class CaseListQuery(Schema):
    page: int = Field(default=1, ge=1, le=10_000)
    pageSize: int = Field(default=20, ge=1, le=50)
    status: CaseStatus | None = None
    disposition: CaseDisposition | None = None
    intent: CaseIntent | None = None
    publicationState: CasePublicationState | None = None
    assigneeId: UUID | None = None
    search: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = ""


class CreateCaseInput(Schema):
    title: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=200)]
    description: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=12, max_length=6000),
    ]
    intent: CaseIntent = "issue"
    affectedArea: Annotated[str, StringConstraints(strip_whitespace=True, max_length=160)] = ""
    expectedOutcome: Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=3000),
    ] = ""
    environmentContext: Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=2000),
    ] = ""
    settingsContext: Annotated[
        str,
        StringConstraints(strip_whitespace=True, max_length=2000),
    ] = ""
    constraints: Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)] = ""
    evidenceNotes: list[
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=3000)]
    ] = Field(default_factory=list, max_length=12)
    summary: Annotated[str, StringConstraints(strip_whitespace=True, max_length=3000)] = ""
    disposition: CaseDisposition = "unclassified"
    dueDate: date | None = None
    assigneeId: UUID | None = None


class UpdateCaseInput(Schema):
    status: CaseStatus | None = None
    disposition: CaseDisposition | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    dueDate: date | None = None
    resolutionSummary: Annotated[
        str | None,
        StringConstraints(strip_whitespace=True, max_length=4000),
    ] = None
    publicationState: Literal["draft", "archived"] | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one case change.")
        return self


class UpdateCaseAssignmentInput(Schema):
    assigneeId: UUID | None


class PublishCaseInput(Schema):
    assigneeId: UUID | None = None


class CaseEventSchema(Schema):
    id: UUID
    type: str
    actorName: str
    payload: dict
    createdAt: datetime


class CaseEvidenceSchema(Schema):
    id: UUID
    kind: Literal["text", "image"]
    text: str
    caption: str
    originalFilename: str
    mimeType: str
    byteSize: int | None
    width: int | None
    height: int | None
    downloadUrl: str | None
    createdAt: datetime


class CreateTextEvidenceInput(Schema):
    text: Annotated[
        str,
        StringConstraints(strip_whitespace=True, min_length=3, max_length=3000),
    ]


class CreateAssessmentInput(Schema):
    provider: Literal["gemini", "openai", "qwen", "bedrock", "custom", "local"]
    intelligence: Literal["fast", "balanced", "high"]


class ConfidenceFactorSchema(Schema):
    name: str
    score: float
    rationale: str


class CaseAssessmentSchema(Schema):
    id: UUID
    sequence: int
    sourceRunId: UUID | None
    provider: str
    model: str
    intelligence: str
    promptVersion: str
    result: dict
    proposedDisposition: CaseDisposition
    modelConfidence: float
    decisionConfidence: float
    confidenceBand: Literal["low", "medium", "high"]
    confidenceFactors: list[ConfidenceFactorSchema]
    isApplied: bool
    appliedAt: datetime | None
    createdAt: datetime


class CaseWorkflowRunSchema(Schema):
    id: UUID
    workflowId: Literal["bug-triage", "meeting-actions", "status-update"]
    status: Literal["pending", "completed", "failed"]
    executionPhase: str
    createdAt: datetime
    completedAt: datetime | None


class CaseWorkItemSchema(Schema):
    id: UUID
    title: str
    description: str
    kind: Literal["engineering", "verification", "investigation", "follow-up"]
    status: Literal["todo", "in-progress", "blocked", "done"]
    assignee: WorkspaceMemberSchema | None
    dueDate: date | None
    sourceRunId: UUID | None
    sourceHandoffId: UUID | None
    createdAt: datetime
    updatedAt: datetime


class CaseDetailSchema(CaseSummarySchema):
    description: str
    affectedArea: str
    expectedOutcome: str
    environmentContext: str
    settingsContext: str
    constraints: str
    publishedAt: datetime | None
    resolutionSummary: str
    resolvedAt: datetime | None
    closedAt: datetime | None
    workflowRuns: list[CaseWorkflowRunSchema]
    evidence: list[CaseEvidenceSchema]
    assessments: list[CaseAssessmentSchema]
    workItems: list[CaseWorkItemSchema]
    events: list[CaseEventSchema]
