from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID

from ninja import Schema
from pydantic import Field, HttpUrl, StringConstraints, model_validator

CaseStatus = Literal[
    "new",
    "triaging",
    "needs-information",
    "action-required",
    "in-progress",
    "verification",
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
WorkspaceAccessRole = Literal["owner", "operator", "contributor", "viewer"]


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
    accessRole: WorkspaceAccessRole


class WorkspaceRosterMemberSchema(WorkspaceMemberSchema):
    membershipState: Literal["sample", "active", "inactive"]
    isActive: bool
    workosManaged: bool
    joinedAt: datetime | None
    assignedCaseCount: int
    openTaskCount: int


class WorkspaceMemberList(Schema):
    items: list[WorkspaceRosterMemberSchema]


class WorkspaceSummarySchema(Schema):
    id: UUID
    name: str
    workosOrganizationId: str | None
    collaborationState: Literal["personal", "provisioning", "active", "error"]
    accessRole: WorkspaceAccessRole
    isCurrent: bool


class WorkspaceContextSchema(Schema):
    currentWorkspaceId: UUID
    items: list[WorkspaceSummarySchema]


class ActivateCollaborationInput(Schema):
    name: Annotated[
        str | None, StringConstraints(strip_whitespace=True, min_length=2, max_length=120)
    ] = None


class WorkspaceInvitationSchema(Schema):
    id: UUID
    email: str
    accessRole: WorkspaceAccessRole
    state: Literal["pending", "accepted", "expired", "revoked", "failed"]
    targetMemberId: UUID | None
    targetMemberName: str | None
    expiresAt: datetime | None
    acceptedAt: datetime | None
    revokedAt: datetime | None
    createdAt: datetime


class WorkspaceInvitationList(Schema):
    items: list[WorkspaceInvitationSchema]


class InviteWorkspaceMemberInput(Schema):
    email: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=254)]
    accessRole: Literal["operator", "contributor", "viewer"] = "contributor"
    targetMemberId: UUID | None = None


class UpdateWorkspaceMemberInput(Schema):
    accessRole: Literal["operator", "contributor", "viewer"] | None = None
    active: bool | None = None

    @model_validator(mode="after")
    def require_change(self):
        if not self.model_fields_set:
            raise ValueError("Provide at least one membership change.")
        return self


class WorkspaceReconciliationSchema(Schema):
    memberCount: int
    invitationCount: int


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
    assessmentId: UUID | None = None
    overrideAdvisory: bool = False


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
    blockerReason: str
    completedAt: datetime | None
    sourceRunId: UUID | None
    sourceHandoffId: UUID | None
    createdAt: datetime
    updatedAt: datetime


class CaseUpdateAttachmentSchema(Schema):
    id: UUID
    originalFilename: str
    mimeType: str
    byteSize: int
    width: int
    height: int
    downloadUrl: str


class CaseUpdateSchema(Schema):
    id: UUID
    type: Literal["progress", "blocker", "decision", "clarification", "resolution", "verification"]
    body: str
    author: WorkspaceMemberSchema | None
    taskId: UUID | None
    externalLinks: list[dict]
    verificationResult: Literal["", "passed", "failed"]
    attachments: list[CaseUpdateAttachmentSchema]
    createdAt: datetime


class ExternalLinkInput(Schema):
    label: Annotated[str, StringConstraints(strip_whitespace=True, min_length=2, max_length=80)]
    url: HttpUrl


class CreateCaseUpdateInput(Schema):
    clientRequestId: UUID
    type: Literal["progress", "blocker", "decision", "clarification", "resolution", "verification"]
    body: Annotated[str, StringConstraints(strip_whitespace=True, min_length=3, max_length=6000)]
    taskId: UUID | None = None
    externalLinks: list[ExternalLinkInput] = Field(default_factory=list, max_length=8)
    verificationResult: Literal["passed", "failed"] | None = None

    @model_validator(mode="after")
    def validate_verification(self):
        if self.type == "verification" and self.verificationResult is None:
            raise ValueError("A verification update requires a passed or failed result.")
        if self.type != "verification" and self.verificationResult is not None:
            raise ValueError("Only verification updates can include a verification result.")
        return self


class CaseDetailSchema(CaseSummarySchema):
    description: str
    affectedArea: str
    expectedOutcome: str
    environmentContext: str
    settingsContext: str
    constraints: str
    publishedAt: datetime | None
    publishedAssessmentId: UUID | None
    resolutionSummary: str
    resolvedAt: datetime | None
    closedAt: datetime | None
    workflowRuns: list[CaseWorkflowRunSchema]
    evidence: list[CaseEvidenceSchema]
    assessments: list[CaseAssessmentSchema]
    workItems: list[CaseWorkItemSchema]
    updates: list[CaseUpdateSchema]
    events: list[CaseEventSchema]
