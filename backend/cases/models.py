import uuid
from pathlib import Path

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from accounts.models import AppUser


def case_evidence_upload_to(instance, filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    return f"case-evidence/{instance.case.workspace_id}/{instance.case_id}/{uuid.uuid4()}{suffix}"


def case_update_upload_to(instance, filename: str) -> str:
    suffix = Path(filename).suffix.lower()
    update = instance.update
    return f"case-updates/{update.case.workspace_id}/{update.case_id}/{uuid.uuid4()}{suffix}"


class Workspace(models.Model):
    class CollaborationState(models.TextChoices):
        PERSONAL = "personal", "Personal"
        PROVISIONING = "provisioning", "Provisioning"
        ACTIVE = "active", "Active"
        ERROR = "error", "Error"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    owner = models.OneToOneField(
        AppUser,
        on_delete=models.CASCADE,
        related_name="personal_workspace",
    )
    name = models.CharField(max_length=120, default="Personal workspace")
    workos_organization_id = models.CharField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
    )
    collaboration_state = models.CharField(
        max_length=16,
        choices=CollaborationState.choices,
        default=CollaborationState.PERSONAL,
    )
    collaboration_enabled_at = models.DateTimeField(blank=True, null=True)
    collaboration_error_code = models.CharField(max_length=64, blank=True)
    workos_synced_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workspaces"
        ordering = ["created_at"]


class WorkspaceMember(models.Model):
    class MembershipState(models.TextChoices):
        SAMPLE = "sample", "Sample profile"
        ACTIVE = "active", "Active"
        INACTIVE = "inactive", "Inactive"

    class AccessRole(models.TextChoices):
        OWNER = "owner", "Owner"
        OPERATOR = "operator", "Operator"
        CONTRIBUTOR = "contributor", "Contributor"
        VIEWER = "viewer", "Viewer"

    class Tone(models.TextChoices):
        INDIGO = "indigo", "Indigo"
        CYAN = "cyan", "Cyan"
        AMBER = "amber", "Amber"
        NEUTRAL = "neutral", "Neutral"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="members")
    app_user = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="workspace_memberships",
        blank=True,
        null=True,
    )
    key = models.CharField(max_length=64)
    name = models.CharField(max_length=120)
    email = models.EmailField(blank=True, null=True)
    initials = models.CharField(max_length=4)
    role = models.CharField(max_length=120)
    discipline = models.CharField(max_length=80)
    focus = models.TextField(max_length=1000, blank=True)
    availability = models.CharField(max_length=40, default="Available")
    workflow_fit = models.JSONField(default=list, blank=True)
    tone = models.CharField(max_length=16, choices=Tone.choices, default=Tone.NEUTRAL)
    access_role = models.CharField(
        max_length=16,
        choices=AccessRole.choices,
        default=AccessRole.CONTRIBUTOR,
    )
    is_sample = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    membership_state = models.CharField(
        max_length=16,
        choices=MembershipState.choices,
        default=MembershipState.ACTIVE,
    )
    workos_membership_id = models.CharField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
    )
    external_updated_at = models.DateTimeField(blank=True, null=True)
    joined_at = models.DateTimeField(blank=True, null=True)
    deactivated_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workspace_members"
        ordering = ["is_sample", "name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "key"],
                name="cases_ws_member_key_uniq",
            ),
            models.UniqueConstraint(
                fields=["workspace", "app_user"],
                condition=models.Q(app_user__isnull=False),
                name="cases_ws_account_uniq",
            ),
        ]
        indexes = [models.Index(fields=["workspace", "is_active", "name"])]


class WorkspaceInvitation(models.Model):
    class State(models.TextChoices):
        PENDING = "pending", "Pending"
        ACCEPTED = "accepted", "Accepted"
        EXPIRED = "expired", "Expired"
        REVOKED = "revoked", "Revoked"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(
        Workspace,
        on_delete=models.CASCADE,
        related_name="invitations",
    )
    email = models.EmailField()
    access_role = models.CharField(
        max_length=16,
        choices=WorkspaceMember.AccessRole.choices,
        default=WorkspaceMember.AccessRole.CONTRIBUTOR,
    )
    state = models.CharField(max_length=16, choices=State.choices, default=State.PENDING)
    workos_invitation_id = models.CharField(
        max_length=255,
        unique=True,
        blank=True,
        null=True,
    )
    target_member = models.ForeignKey(
        WorkspaceMember,
        on_delete=models.SET_NULL,
        related_name="replacement_invitations",
        blank=True,
        null=True,
    )
    invited_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="workspace_invitations_sent",
        blank=True,
        null=True,
    )
    accepted_user = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="workspace_invitations_accepted",
        blank=True,
        null=True,
    )
    accepted_at = models.DateTimeField(blank=True, null=True)
    revoked_at = models.DateTimeField(blank=True, null=True)
    expires_at = models.DateTimeField(blank=True, null=True)
    external_updated_at = models.DateTimeField(blank=True, null=True)
    failure_code = models.CharField(max_length=64, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "workspace_invitations"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "email"],
                condition=models.Q(state="pending"),
                name="cases_ws_pending_invite_uniq",
            ),
            models.UniqueConstraint(
                fields=["workspace", "target_member"],
                condition=models.Q(state="pending", target_member__isnull=False),
                name="cases_ws_pending_target_uniq",
            ),
        ]
        indexes = [models.Index(fields=["workspace", "state", "-created_at"])]


class WorkOSEventReceipt(models.Model):
    event_id = models.CharField(max_length=255, primary_key=True)
    event_type = models.CharField(max_length=120)
    workos_organization_id = models.CharField(max_length=255, blank=True)
    object_id = models.CharField(max_length=255, blank=True)
    external_updated_at = models.DateTimeField(blank=True, null=True)
    received_at = models.DateTimeField(auto_now_add=True)
    processed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "workos_event_receipts"
        ordering = ["-received_at"]
        indexes = [models.Index(fields=["workos_organization_id", "-received_at"])]


class OperationsCase(models.Model):
    class Intent(models.TextChoices):
        ISSUE = "issue", "Issue investigation"
        CLARIFICATION = "clarification", "Clarification or guidance"
        ENHANCEMENT = "enhancement", "Additional development"

    class PublicationState(models.TextChoices):
        DRAFT = "draft", "Draft"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"

    class Status(models.TextChoices):
        NEW = "new", "New"
        TRIAGING = "triaging", "Triaging"
        NEEDS_INFORMATION = "needs-information", "Needs information"
        ACTION_REQUIRED = "action-required", "Action required"
        IN_PROGRESS = "in-progress", "In progress"
        VERIFICATION = "verification", "Verification"
        MONITORING = "monitoring", "Monitoring"
        RESOLVED = "resolved", "Resolved"
        CLOSED = "closed", "Closed"

    class Disposition(models.TextChoices):
        UNCLASSIFIED = "unclassified", "Unclassified"
        PRODUCT_DEFECT = "product-defect", "Product defect"
        CONFIGURATION_CHANGE = "configuration-change", "Configuration change"
        PROCESS_GUIDANCE = "process-guidance", "Process guidance"
        EXTERNAL_DEPENDENCY = "external-dependency", "External dependency"
        DUPLICATE = "duplicate", "Duplicate"
        NEEDS_MORE_EVIDENCE = "needs-more-evidence", "Needs more evidence"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="cases")
    number = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    description = models.TextField(max_length=6000)
    intent = models.CharField(max_length=24, choices=Intent.choices, default=Intent.ISSUE)
    publication_state = models.CharField(
        max_length=16,
        choices=PublicationState.choices,
        default=PublicationState.DRAFT,
    )
    affected_area = models.CharField(max_length=160, blank=True)
    expected_outcome = models.TextField(max_length=3000, blank=True)
    environment_context = models.TextField(max_length=2000, blank=True)
    settings_context = models.TextField(max_length=2000, blank=True)
    constraints = models.TextField(max_length=2000, blank=True)
    summary = models.TextField(max_length=3000, blank=True)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.NEW)
    disposition = models.CharField(
        max_length=32,
        choices=Disposition.choices,
        default=Disposition.UNCLASSIFIED,
    )
    confidence = models.FloatField(
        blank=True,
        null=True,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
    )
    resolution_summary = models.TextField(max_length=4000, blank=True)
    due_date = models.DateField(blank=True, null=True)
    created_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="created_operations_cases",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(blank=True, null=True)
    published_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="published_operations_cases",
        blank=True,
        null=True,
    )
    published_assessment = models.ForeignKey(
        "CaseAssessment",
        on_delete=models.SET_NULL,
        related_name="publication_decisions",
        blank=True,
        null=True,
    )
    resolved_at = models.DateTimeField(blank=True, null=True)
    closed_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "operations_cases"
        ordering = ["-updated_at", "-number"]
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "number"],
                name="cases_ws_number_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["workspace", "publication_state", "-updated_at"]),
            models.Index(fields=["workspace", "status", "-updated_at"]),
            models.Index(fields=["workspace", "disposition", "-updated_at"]),
        ]

    @property
    def key(self) -> str:
        return f"OPS-{self.number:04d}"


class CaseAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.OneToOneField(
        OperationsCase,
        on_delete=models.CASCADE,
        related_name="assignment",
    )
    assignee = models.ForeignKey(
        WorkspaceMember,
        on_delete=models.SET_NULL,
        related_name="case_assignments",
        blank=True,
        null=True,
    )
    assigned_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="case_assignments_made",
        blank=True,
        null=True,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "case_assignments"


class CaseEvent(models.Model):
    class Type(models.TextChoices):
        CREATED = "created", "Created"
        UPDATED = "updated", "Updated"
        ASSIGNMENT_CHANGED = "assignment-changed", "Assignment changed"
        STATUS_CHANGED = "status-changed", "Status changed"
        DISPOSITION_CHANGED = "disposition-changed", "Disposition changed"
        WORKFLOW_LINKED = "workflow-linked", "Workflow linked"
        WORK_ITEM_CREATED = "work-item-created", "Work item created"
        WORK_ITEM_UPDATED = "work-item-updated", "Work item updated"
        RESOLUTION_RECORDED = "resolution-recorded", "Resolution recorded"
        PUBLISHED = "published", "Published"
        ARCHIVED = "archived", "Archived"
        EVIDENCE_ADDED = "evidence-added", "Evidence added"
        EVIDENCE_REMOVED = "evidence-removed", "Evidence removed"
        ASSESSMENT_CREATED = "assessment-created", "Assessment created"
        ASSESSMENT_APPLIED = "assessment-applied", "Assessment applied"
        UPDATE_ADDED = "update-added", "Update added"
        TASK_CREATED = "task-created", "Task created"
        TASK_UPDATED = "task-updated", "Task updated"
        VERIFICATION_RECORDED = "verification-recorded", "Verification recorded"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(OperationsCase, on_delete=models.CASCADE, related_name="events")
    actor = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="case_events",
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=32, choices=Type.choices)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "case_events"
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["case", "-created_at"])]


class CaseEvidence(models.Model):
    class Kind(models.TextChoices):
        TEXT = "text", "Text"
        IMAGE = "image", "Image"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(OperationsCase, on_delete=models.CASCADE, related_name="evidence")
    created_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="case_evidence",
        blank=True,
        null=True,
    )
    kind = models.CharField(max_length=12, choices=Kind.choices)
    text = models.TextField(max_length=3000, blank=True)
    file = models.FileField(upload_to=case_evidence_upload_to, max_length=500, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    caption = models.CharField(max_length=500, blank=True)
    mime_type = models.CharField(max_length=64, blank=True)
    byte_size = models.PositiveIntegerField(blank=True, null=True)
    width = models.PositiveIntegerField(blank=True, null=True)
    height = models.PositiveIntegerField(blank=True, null=True)
    sha256 = models.CharField(max_length=64, blank=True)
    sort_order = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "case_evidence"
        ordering = ["sort_order", "created_at", "id"]
        indexes = [models.Index(fields=["case", "created_at"])]


class CaseAssessment(models.Model):
    class ConfidenceBand(models.TextChoices):
        LOW = "low", "Low"
        MEDIUM = "medium", "Medium"
        HIGH = "high", "High"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(OperationsCase, on_delete=models.CASCADE, related_name="assessments")
    source_run = models.OneToOneField(
        "runs.WorkflowRun",
        on_delete=models.SET_NULL,
        related_name="case_assessment",
        blank=True,
        null=True,
    )
    sequence = models.PositiveIntegerField()
    created_by = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="case_assessments",
        blank=True,
        null=True,
    )
    provider = models.CharField(max_length=32)
    model = models.CharField(max_length=256)
    intelligence = models.CharField(max_length=16)
    prompt_version = models.CharField(max_length=64)
    evidence_snapshot = models.JSONField(default=list)
    result_json = models.JSONField(default=dict)
    proposed_disposition = models.CharField(
        max_length=32,
        choices=OperationsCase.Disposition.choices,
        default=OperationsCase.Disposition.UNCLASSIFIED,
    )
    model_confidence = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    decision_confidence = models.FloatField(validators=[MinValueValidator(0), MaxValueValidator(1)])
    confidence_band = models.CharField(max_length=12, choices=ConfidenceBand.choices)
    confidence_factors = models.JSONField(default=list)
    is_applied = models.BooleanField(default=False)
    applied_at = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "case_assessments"
        ordering = ["-sequence", "-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["case", "sequence"],
                name="cases_assessment_sequence_uniq",
            )
        ]
        indexes = [models.Index(fields=["case", "-sequence"])]


class CaseUpdate(models.Model):
    class Type(models.TextChoices):
        PROGRESS = "progress", "Progress"
        BLOCKER = "blocker", "Blocker"
        DECISION = "decision", "Decision"
        CLARIFICATION = "clarification", "Clarification"
        RESOLUTION = "resolution", "Resolution proposal"
        VERIFICATION = "verification", "Verification"

    class VerificationResult(models.TextChoices):
        PASSED = "passed", "Passed"
        FAILED = "failed", "Failed"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(OperationsCase, on_delete=models.CASCADE, related_name="updates")
    author = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="case_updates",
        blank=True,
        null=True,
    )
    author_member = models.ForeignKey(
        WorkspaceMember,
        on_delete=models.SET_NULL,
        related_name="authored_case_updates",
        blank=True,
        null=True,
    )
    task = models.ForeignKey(
        "workitems.WorkItem",
        on_delete=models.SET_NULL,
        related_name="case_updates",
        blank=True,
        null=True,
    )
    update_type = models.CharField(max_length=20, choices=Type.choices)
    body = models.TextField(max_length=6000)
    external_links = models.JSONField(default=list, blank=True)
    verification_result = models.CharField(
        max_length=12,
        choices=VerificationResult.choices,
        blank=True,
    )
    client_request_id = models.UUIDField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "case_updates"
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["case", "client_request_id"],
                name="cases_update_request_uniq",
            )
        ]
        indexes = [
            models.Index(fields=["case", "-created_at"]),
            models.Index(fields=["author_member", "-created_at"]),
        ]


class CaseUpdateAttachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    update = models.ForeignKey(CaseUpdate, on_delete=models.CASCADE, related_name="attachments")
    file = models.FileField(upload_to=case_update_upload_to, max_length=500)
    original_filename = models.CharField(max_length=255)
    mime_type = models.CharField(max_length=64)
    byte_size = models.PositiveIntegerField()
    width = models.PositiveIntegerField()
    height = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "case_update_attachments"
        ordering = ["created_at", "id"]
        indexes = [models.Index(fields=["update", "created_at"])]


class CaseDomainEvent(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    case = models.ForeignKey(
        OperationsCase,
        on_delete=models.CASCADE,
        related_name="domain_events",
    )
    actor = models.ForeignKey(
        AppUser,
        on_delete=models.SET_NULL,
        related_name="case_domain_events",
        blank=True,
        null=True,
    )
    event_type = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    delivered_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        db_table = "case_domain_events"
        ordering = ["created_at", "id"]
        indexes = [
            models.Index(fields=["delivered_at", "created_at"]),
            models.Index(fields=["case", "created_at"]),
        ]
