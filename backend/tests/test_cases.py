import io
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.uploadhandler import StopUpload
from django.test import Client, override_settings
from PIL import Image
from pydantic import BaseModel

from accounts.models import AppUser
from ai.providers.registry import ResolvedProvider
from ai.types import ProviderResult
from cases.assessments import apply_assessment, run_case_assessment
from cases.delivery import create_case_update
from cases.models import (
    CaseAssessment,
    CaseDomainEvent,
    CaseEvent,
    CaseEvidence,
    CaseUpdate,
    OperationsCase,
    WorkspaceMember,
)
from cases.selectors import member_for_key
from cases.services import (
    assign_case,
    create_case,
    ensure_personal_workspace,
    publish_case,
    record_case_event,
    update_case,
)
from common.errors import OpsPilotError
from common.upload_handlers import BoundedTemporaryFileUploadHandler

pytestmark = pytest.mark.django_db


class CaseAssessmentStub:
    def generate_structured(self, *, output_schema: type[BaseModel], **kwargs) -> ProviderResult:
        return ProviderResult(
            output=output_schema.model_validate(
                {
                    "summary": "The role-specific behavior is most consistent with configuration.",
                    "confirmedFacts": ["The field is absent for the payroll consultant."],
                    "contradictingEvidence": [],
                    "evidenceGaps": ["The visibility setting has not been inspected."],
                    "likelyCategory": "Payroll field visibility",
                    "issueType": "configuration-or-process",
                    "routing": {
                        "team": "support",
                        "ownerId": None,
                        "rationale": "Verify supported settings before engineering escalation.",
                    },
                    "recommendedChecks": ["Inspect the Holiday visibility setting."],
                    "recommendedResolution": "Enable the supported visibility setting if disabled.",
                    "verificationSteps": ["Inspect settings", "Reopen payroll", "Verify field"],
                    "confidence": 0.84,
                    "humanReviewNotice": "An operator must verify the exact setting path.",
                    "humanReviewRequired": True,
                }
            ),
            input_tokens=120,
            output_tokens=80,
        )


def _authenticate(client: Client) -> AppUser:
    response = client.get("/api/v1/me")
    assert response.status_code == 200
    return AppUser.objects.get(workos_user_id="user_test_primary")


def test_personal_workspace_and_sample_members_are_persisted(
    authenticated_client: Client,
) -> None:
    user = _authenticate(authenticated_client)

    response = authenticated_client.get("/api/v1/workspace/members")

    assert response.status_code == 200
    members = response.json()["items"]
    assert len(members) == 6
    assert sum(member["isSample"] for member in members) == 5
    assert any(member["linkedAccount"] and not member["isSample"] for member in members)
    assert {member["key"] for member in members if member["isSample"]} == {
        "sample-amelia-cruz",
        "sample-kai-mercer",
        "sample-theo-bennett",
        "sample-mina-park",
        "sample-rafael-silva",
    }
    assert user.personal_workspace.members.count() == 6


def test_case_lifecycle_assignment_filters_and_timeline(authenticated_client: Client) -> None:
    user = _authenticate(authenticated_client)
    kai = WorkspaceMember.objects.get(workspace__owner=user, key="sample-kai-mercer")
    mina = WorkspaceMember.objects.get(workspace__owner=user, key="sample-mina-park")
    created = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Holiday field is missing",
            "description": (
                "A payroll consultant cannot see the Holiday field while reviewing a client run."
            ),
            "summary": "Verify whether the payroll Holiday setting is disabled.",
            "disposition": "configuration-change",
            "dueDate": "2026-08-31",
            "assigneeId": str(kai.id),
        },
        content_type="application/json",
    )

    assert created.status_code == 201
    body = created.json()
    assert body["key"] == "OPS-0001"
    assert body["assignee"]["id"] == str(kai.id)
    assert [event["type"] for event in body["events"]] == [
        "assignment-changed",
        "published",
        "created",
    ]
    assert body["publicationState"] == "published"

    invalid = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "in-progress"},
        content_type="application/json",
    )
    assert invalid.status_code == 409
    assert invalid.json()["error"]["code"] == "INVALID_CASE_TRANSITION"

    triaging = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "triaging", "confidence": 0.82},
        content_type="application/json",
    )
    assert triaging.status_code == 200
    in_progress = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "in-progress"},
        content_type="application/json",
    )
    assert in_progress.status_code == 200

    reassigned = authenticated_client.put(
        f"/api/v1/cases/{body['id']}/assignment",
        data={"assigneeId": str(mina.id)},
        content_type="application/json",
    )
    assert reassigned.status_code == 200
    assert reassigned.json()["assignee"]["key"] == "sample-mina-park"

    listed = authenticated_client.get(
        "/api/v1/cases",
        {"assigneeId": str(mina.id), "status": "in-progress", "search": "Holiday"},
    )
    assert listed.status_code == 200
    assert listed.json()["total"] == 1
    assert listed.json()["items"][0]["id"] == body["id"]
    assert CaseEvent.objects.filter(case_id=body["id"], event_type="status-changed").count() == 2

    enriched = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={
            "disposition": "process-guidance",
            "confidence": None,
            "dueDate": None,
            "resolutionSummary": "Verified the supported payroll configuration path.",
        },
        content_type="application/json",
    )
    assert enriched.status_code == 200
    assert enriched.json()["dueDate"] is None
    assert enriched.json()["confidence"] is None
    assert enriched.json()["resolutionSummary"].startswith("Verified")

    resolved = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "resolved"},
        content_type="application/json",
    )
    assert resolved.status_code == 200
    assert resolved.json()["resolvedAt"] is not None
    closed = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "closed"},
        content_type="application/json",
    )
    assert closed.json()["resolvedAt"] is not None
    assert closed.json()["closedAt"] is not None
    reopened = authenticated_client.patch(
        f"/api/v1/cases/{body['id']}",
        data={"status": "triaging"},
        content_type="application/json",
    )
    assert reopened.json()["closedAt"] is None

    unassigned = assign_case(user=user, case_id=body["id"], assignee_id=None)
    event_count = CaseEvent.objects.filter(case=unassigned).count()
    assign_case(user=user, case_id=body["id"], assignee_id=None)
    assert unassigned.assignment.assignee is None
    assert CaseEvent.objects.filter(case=unassigned).count() == event_count
    record_case_event(case=unassigned, event_type=CaseEvent.Type.UPDATED, actor=None)
    detail = authenticated_client.get(f"/api/v1/cases/{body['id']}").json()
    assert detail["events"][0]["actorName"] == "OpsPilot"
    assert member_for_key(user=user, key="") is None
    assert member_for_key(user=user, key="sample-mina-park") == mina


def test_case_pagination_and_workspace_authorization(authenticated_client: Client) -> None:
    user = _authenticate(authenticated_client)
    for index in range(3):
        create_case(
            user=user,
            title=f"Delivery question {index}",
            description="The operations team needs a durable owner and a reviewed next action.",
            summary="Review and route this delivery question.",
            disposition=OperationsCase.Disposition.NEEDS_MORE_EVIDENCE,
            due_date=None,
            assignee_id=None,
        )
    page = authenticated_client.get("/api/v1/cases", {"page": 2, "pageSize": 1})
    assert page.status_code == 200
    assert page.json()["page"] == 2
    assert page.json()["total"] == 3
    assert page.json()["hasMore"] is True

    other = AppUser.objects.create(workos_user_id="other-case-user", email="other@example.com")
    foreign_member = other.personal_workspace.members.get(key="sample-mina-park")
    foreign_case = create_case(
        user=other,
        title="Private workspace case",
        description="This case belongs to a separate personal workspace and must stay private.",
        summary="Private case",
        disposition=OperationsCase.Disposition.UNCLASSIFIED,
        due_date=None,
        assignee_id=foreign_member.id,
    )

    assert authenticated_client.get(f"/api/v1/cases/{foreign_case.id}").status_code == 404
    rejected = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Invalid foreign assignment",
            "description": "A foreign workspace member cannot be assigned to this personal case.",
            "assigneeId": str(foreign_member.id),
        },
        content_type="application/json",
    )
    assert rejected.status_code == 422
    assert rejected.json()["error"]["code"] == "INVALID_ASSIGNEE"


def test_personal_workspace_cases_do_not_block_account_deletion() -> None:
    user = AppUser.objects.create(
        workos_user_id="deletable-case-user",
        email="delete-case@example.com",
    )
    case = create_case(
        user=user,
        title="Delete this personal workspace",
        description="Account erasure must remove the personal workspace and its durable case data.",
        summary="Deletion lifecycle coverage.",
        disposition=OperationsCase.Disposition.UNCLASSIFIED,
        due_date=None,
        assignee_id=None,
    )

    user.delete()

    assert not AppUser.objects.filter(workos_user_id="deletable-case-user").exists()
    assert not OperationsCase.objects.filter(id=case.id).exists()


def test_case_first_assessment_is_versioned_and_never_publishes_automatically(
    authenticated_client: Client,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    _authenticate(authenticated_client)
    monkeypatch.setattr(
        "runs.services.get_provider",
        lambda **kwargs: ResolvedProvider(
            adapter=CaseAssessmentStub(),
            credential_source="platform",
        ),
    )
    created = authenticated_client.post(
        "/api/v1/cases",
        data={
            "intent": "issue",
            "title": "Holiday field is missing",
            "description": "The payroll consultant cannot see the Holiday field in payroll entry.",
            "affectedArea": "Payroll entry",
            "expectedOutcome": "The consultant should see the Holiday field.",
            "evidenceNotes": ["Administrators can see the field."],
        },
        content_type="application/json",
    )
    assert created.status_code == 201
    case = created.json()
    assert case["publicationState"] == "draft"
    assert case["disposition"] == "unclassified"
    assert case["evidence"][0]["kind"] == "text"

    run = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/assessments",
        data={"provider": "gemini", "intelligence": "balanced"},
        content_type="application/json",
    )
    assert run.status_code == 201
    detail = authenticated_client.get(f"/api/v1/cases/{case['id']}").json()
    assert detail["publicationState"] == "draft"
    assert detail["disposition"] == "unclassified"
    assert len(detail["assessments"]) == 1
    assessment = detail["assessments"][0]
    assert assessment["provider"] == "gemini"
    assert assessment["model"] == "gemini-3.6-flash"
    assert assessment["proposedDisposition"] == "configuration-change"
    assert assessment["confidenceBand"] in {"medium", "high"}
    assert CaseAssessment.objects.get(id=assessment["id"]).evidence_snapshot[0]["kind"] == "text"

    applied = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/assessments/{assessment['id']}/apply",
        data={},
        content_type="application/json",
    )
    assert applied.status_code == 200
    assert applied.json()["publicationState"] == "draft"
    assert applied.json()["disposition"] == "configuration-change"
    assert applied.json()["confidence"] == assessment["decisionConfidence"]

    published = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/publish",
        data={"assigneeId": None},
        content_type="application/json",
    )
    assert published.status_code == 200
    assert published.json()["publicationState"] == "published"


def test_enhancement_can_publish_but_cannot_run_bug_assessment(
    authenticated_client: Client,
) -> None:
    _authenticate(authenticated_client)
    created = authenticated_client.post(
        "/api/v1/cases",
        data={
            "intent": "enhancement",
            "title": "Add payroll approval dashboard",
            "description": (
                "Operations needs an additional dashboard for payroll approval visibility."
            ),
        },
        content_type="application/json",
    ).json()
    rejected = authenticated_client.post(
        f"/api/v1/cases/{created['id']}/assessments",
        data={"provider": "gemini", "intelligence": "fast"},
        content_type="application/json",
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "CASE_INTENT_NOT_TRIAGEABLE"
    published = authenticated_client.post(
        f"/api/v1/cases/{created['id']}/publish",
        data={"assigneeId": None},
        content_type="application/json",
    )
    assert published.status_code == 200
    assert published.json()["publicationState"] == "published"


def test_issue_publication_records_advisory_override_and_updates_are_idempotent(
    authenticated_client: Client,
) -> None:
    _authenticate(authenticated_client)
    case = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Payroll export remains queued",
            "description": "The payroll export remains queued after the consultant submits it.",
        },
        content_type="application/json",
    ).json()
    rejected = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/publish",
        data={"assigneeId": None},
        content_type="application/json",
    )
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "ADVISORY_REVIEW_REQUIRED"

    published = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/publish",
        data={"assigneeId": None, "overrideAdvisory": True},
        content_type="application/json",
    )
    assert published.status_code == 200
    assert published.json()["publishedAssessmentId"] is None
    published_event = CaseEvent.objects.get(case_id=case["id"], event_type="published")
    assert published_event.payload["advisoryOverride"] is True

    payload = {
        "clientRequestId": "dbdf7ebf-874c-4bb7-bb63-d1911c50f8aa",
        "type": "progress",
        "body": "Reproduced the queue delay and captured the worker timeline.",
    }
    first = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/updates",
        data=payload,
        content_type="application/json",
    )
    duplicate = authenticated_client.post(
        f"/api/v1/cases/{case['id']}/updates",
        data=payload,
        content_type="application/json",
    )
    assert first.status_code == 201
    assert duplicate.status_code == 201
    assert duplicate.json()["id"] == first.json()["id"]
    assert CaseUpdate.objects.filter(case_id=case["id"]).count() == 1


def test_resolution_and_verification_updates_drive_auditable_case_state(
    authenticated_client: Client,
) -> None:
    user = _authenticate(authenticated_client)
    assignee = WorkspaceMember.objects.get(workspace__owner=user, key="sample-mina-park")
    case = create_case(
        user=user,
        title="Holiday configuration verification",
        description="Verify the supported Holiday field setting and confirm the user outcome.",
        assignee_id=assignee.id,
    )
    resolution = authenticated_client.post(
        f"/api/v1/cases/{case.id}/updates",
        data={
            "clientRequestId": "f3ee384c-43dc-4285-b67f-a39b1a973289",
            "type": "resolution",
            "body": "Enabled the supported Holiday visibility setting and reopened payroll entry.",
        },
        content_type="application/json",
    )
    assert resolution.status_code == 201
    case.refresh_from_db()
    assert case.status == OperationsCase.Status.VERIFICATION
    assert case.resolution_summary.startswith("Enabled the supported")

    verification = authenticated_client.post(
        f"/api/v1/cases/{case.id}/updates",
        data={
            "clientRequestId": "30f3611e-9f43-47e7-8026-b543b31af365",
            "type": "verification",
            "body": "Confirmed the field is visible for the payroll consultant role.",
            "verificationResult": "passed",
        },
        content_type="application/json",
    )
    assert verification.status_code == 201
    detail = authenticated_client.get(f"/api/v1/cases/{case.id}").json()
    assert detail["status"] == "resolved"
    assert detail["updates"][0]["verificationResult"] == "passed"
    assert CaseDomainEvent.objects.filter(
        case=case,
        event_type="case.verification.passed",
        delivered_at__isnull=True,
    ).exists()


def test_case_update_private_image_is_normalized_and_authorized(
    authenticated_client: Client,
    tmp_path,
) -> None:
    user = _authenticate(authenticated_client)
    case = create_case(
        user=user,
        title="Update image evidence",
        description="A delivery update includes a screenshot of the verified user outcome.",
        assignee_id=None,
    )
    authenticated_client.post(
        f"/api/v1/cases/{case.id}/publish",
        data={"assigneeId": None, "overrideAdvisory": True},
        content_type="application/json",
    )
    update = authenticated_client.post(
        f"/api/v1/cases/{case.id}/updates",
        data={
            "clientRequestId": "593c19be-6374-4f79-9068-25199f30f670",
            "type": "progress",
            "body": "Captured the verified payroll field after the configuration change.",
        },
        content_type="application/json",
    ).json()
    source = io.BytesIO()
    Image.new("RGB", (32, 18), color=(48, 68, 120)).save(source, format="PNG")
    with override_settings(MEDIA_ROOT=tmp_path):
        uploaded = authenticated_client.post(
            f"/api/v1/cases/{case.id}/updates/{update['id']}/images",
            data={"file": SimpleUploadedFile("verified.png", source.getvalue(), "image/png")},
        )
        assert uploaded.status_code == 201
        attachment = uploaded.json()
        assert attachment["width"] == 32
        content = authenticated_client.get(
            f"/api/v1/cases/{case.id}/updates/attachments/{attachment['id']}/content"
        )
        assert content.status_code == 200
        assert content["Cache-Control"] == "private, no-store"
        content.close()


def test_case_update_validation_and_failed_verification_paths(
    authenticated_client: Client,
) -> None:
    user = _authenticate(authenticated_client)
    case = create_case(
        user=user,
        title="Bounded update validation",
        description="Case updates reject invalid lifecycle and task context before persistence.",
    )
    with pytest.raises(OpsPilotError) as draft_rejected:
        create_case_update(
            user=user,
            case_id=case.id,
            update_type=CaseUpdate.Type.PROGRESS,
            body="This draft update must not persist.",
            client_request_id=uuid4(),
        )
    assert draft_rejected.value.code == "CASE_NOT_PUBLISHED"
    authenticated_client.post(
        f"/api/v1/cases/{case.id}/publish",
        data={"assigneeId": None, "overrideAdvisory": True},
        content_type="application/json",
    )
    with pytest.raises(OpsPilotError) as missing_result:
        create_case_update(
            user=user,
            case_id=case.id,
            update_type=CaseUpdate.Type.VERIFICATION,
            body="Verification was attempted.",
            client_request_id=uuid4(),
        )
    assert missing_result.value.code == "VERIFICATION_RESULT_REQUIRED"
    with pytest.raises(OpsPilotError) as misplaced_result:
        create_case_update(
            user=user,
            case_id=case.id,
            update_type=CaseUpdate.Type.PROGRESS,
            body="A progress note cannot carry a verification result.",
            verification_result=CaseUpdate.VerificationResult.PASSED,
            client_request_id=uuid4(),
        )
    assert misplaced_result.value.code == "INVALID_VERIFICATION_RESULT"
    with pytest.raises(OpsPilotError) as invalid_task:
        create_case_update(
            user=user,
            case_id=case.id,
            update_type=CaseUpdate.Type.PROGRESS,
            body="This task belongs to no case.",
            task_id=uuid4(),
            client_request_id=uuid4(),
        )
    assert invalid_task.value.code == "INVALID_CASE_TASK"

    blocker = create_case_update(
        user=user,
        case_id=case.id,
        update_type=CaseUpdate.Type.BLOCKER,
        body="The production worker trace is still unavailable.",
        external_links=[{"label": "Runbook", "url": "https://example.com/runbook"}],
        client_request_id=uuid4(),
    )
    case.refresh_from_db()
    assert blocker.external_links[0]["label"] == "Runbook"
    assert case.status == OperationsCase.Status.ACTION_REQUIRED
    failed = create_case_update(
        user=user,
        case_id=case.id,
        update_type=CaseUpdate.Type.VERIFICATION,
        body="The original payroll user still cannot see the field.",
        verification_result=CaseUpdate.VerificationResult.FAILED,
        client_request_id=uuid4(),
    )
    case.refresh_from_db()
    assert failed.verification_result == "failed"
    assert case.status == OperationsCase.Status.IN_PROGRESS
    assert case.resolved_at is None


def test_case_update_image_rejects_unavailable_storage_unknown_update_and_quota(
    authenticated_client: Client,
    tmp_path,
) -> None:
    user = _authenticate(authenticated_client)
    case = create_case(
        user=user,
        title="Update image policy",
        description="Private update images remain bounded by storage availability and quota.",
    )
    authenticated_client.post(
        f"/api/v1/cases/{case.id}/publish",
        data={"assigneeId": None, "overrideAdvisory": True},
        content_type="application/json",
    )
    source = io.BytesIO()
    Image.new("RGB", (8, 8), color=(10, 30, 60)).save(source, format="PNG")
    with override_settings(CASE_EVIDENCE_UPLOADS_ENABLED=False):
        unavailable = authenticated_client.post(
            f"/api/v1/cases/{case.id}/updates/{uuid4()}/images",
            data={"file": SimpleUploadedFile("update.png", source.getvalue(), "image/png")},
        )
    assert unavailable.status_code == 503
    with override_settings(MEDIA_ROOT=tmp_path):
        unknown = authenticated_client.post(
            f"/api/v1/cases/{case.id}/updates/{uuid4()}/images",
            data={"file": SimpleUploadedFile("update.png", source.getvalue(), "image/png")},
        )
    assert unknown.status_code == 404
    update = create_case_update(
        user=user,
        case_id=case.id,
        update_type=CaseUpdate.Type.PROGRESS,
        body="The screenshot is ready for bounded storage.",
        client_request_id=uuid4(),
    )
    with override_settings(MEDIA_ROOT=tmp_path, CASE_EVIDENCE_MAX_WORKSPACE_BYTES=0):
        quota = authenticated_client.post(
            f"/api/v1/cases/{case.id}/updates/{update.id}/images",
            data={"file": SimpleUploadedFile("update.png", source.getvalue(), "image/png")},
        )
    assert quota.status_code == 409
    assert quota.json()["error"]["code"] == "UPDATE_STORAGE_LIMIT_REACHED"


def test_case_reopen_archive_and_publication_validation_paths(
    authenticated_client: Client,
) -> None:
    user = _authenticate(authenticated_client)
    case = create_case(
        user=user,
        title="Lifecycle audit coverage",
        description="Managers can resolve, reopen, archive, and republish a governed case.",
        assignee_id=None,
    )
    with pytest.raises(OpsPilotError) as invalid_advisory:
        publish_case(
            user=user,
            case_id=case.id,
            assessment_id=uuid4(),
            override_advisory=True,
        )
    assert invalid_advisory.value.code == "INVALID_PUBLICATION_ADVISORY"
    published = publish_case(user=user, case_id=case.id, override_advisory=True)
    assert (
        publish_case(user=user, case_id=published.id, override_advisory=True).publication_state
        == "published"
    )
    update_case(user=user, case_id=case.id, status=OperationsCase.Status.TRIAGING)
    update_case(user=user, case_id=case.id, status=OperationsCase.Status.RESOLVED)
    reopened = update_case(user=user, case_id=case.id, status=OperationsCase.Status.MONITORING)
    assert reopened.resolved_at is None
    closed = update_case(user=user, case_id=case.id, status=OperationsCase.Status.CLOSED)
    assert closed.closed_at is not None
    triaging = update_case(user=user, case_id=case.id, status=OperationsCase.Status.TRIAGING)
    assert triaging.closed_at is None
    archived = update_case(
        user=user,
        case_id=case.id,
        publication_state=OperationsCase.PublicationState.ARCHIVED,
    )
    assert archived.publication_state == "archived"
    draft = update_case(
        user=user,
        case_id=case.id,
        publication_state=OperationsCase.PublicationState.DRAFT,
    )
    assert draft.publication_state == "draft"


def test_real_assignee_can_post_updates_and_seed_sync_preserves_linked_profile(
    authenticated_client: Client,
) -> None:
    owner = _authenticate(authenticated_client)
    member = WorkspaceMember.objects.get(workspace__owner=owner, key="sample-kai-mercer")
    case = create_case(
        user=owner,
        title="Real assignee update",
        description="A linked contributor can author genuine progress without sample activity.",
        assignee_id=member.id,
    )
    contributor = AppUser.objects.create(
        workos_user_id="case_update_contributor",
        email="real.assignee@example.com",
        display_name="Real Assignee",
    )
    member.app_user = contributor
    member.is_sample = False
    member.access_role = WorkspaceMember.AccessRole.CONTRIBUTOR
    member.save(update_fields=["app_user", "is_sample", "access_role"])
    ensure_personal_workspace(owner)
    member.refresh_from_db()
    assert member.app_user == contributor
    assert member.is_sample is False
    update = create_case_update(
        user=contributor,
        case_id=case.id,
        update_type=CaseUpdate.Type.PROGRESS,
        body="Verified the tenant configuration and documented the remaining engineering check.",
        client_request_id=uuid4(),
    )
    assert update.author_member == member
    with pytest.raises(OpsPilotError) as assessment_rejected:
        run_case_assessment(
            user=contributor,
            case_id=case.id,
            provider_name="gemini",
            intelligence="fast",
        )
    assert assessment_rejected.value.code == "CASE_MANAGER_REQUIRED"
    with pytest.raises(OpsPilotError) as apply_rejected:
        apply_assessment(user=contributor, case_id=case.id, assessment_id=uuid4())
    assert apply_rejected.value.code == "CASE_MANAGER_REQUIRED"
    member.access_role = WorkspaceMember.AccessRole.VIEWER
    member.save(update_fields=["access_role"])
    with pytest.raises(OpsPilotError) as viewer_rejected:
        create_case_update(
            user=contributor,
            case_id=case.id,
            update_type=CaseUpdate.Type.PROGRESS,
            body="A viewer cannot author a delivery update.",
            client_request_id=uuid4(),
        )
    assert viewer_rejected.value.code == "CASE_CONTRIBUTOR_REQUIRED"


def test_private_image_evidence_is_normalized_authorized_and_removable(
    authenticated_client: Client,
    tmp_path,
) -> None:
    _authenticate(authenticated_client)
    case = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Screenshot evidence case",
            "description": "The screenshot shows a missing field for the payroll consultant role.",
        },
        content_type="application/json",
    ).json()
    source = io.BytesIO()
    Image.new("RGB", (24, 16), color=(35, 70, 120)).save(source, format="PNG")
    upload = SimpleUploadedFile("payroll.png", source.getvalue(), content_type="image/png")
    with override_settings(MEDIA_ROOT=tmp_path):
        response = authenticated_client.post(
            f"/api/v1/cases/{case['id']}/evidence/images?caption=Missing%20Holiday%20field",
            data={"file": upload},
        )
        assert response.status_code == 201
        evidence = response.json()
        assert evidence["mimeType"] == "image/png"
        assert evidence["width"] == 24
        content = authenticated_client.get(
            f"/api/v1/cases/{case['id']}/evidence/{evidence['id']}/content"
        )
        assert content.status_code == 200
        assert content["Cache-Control"] == "private, no-store"
        content.close()
        removed = authenticated_client.delete(
            f"/api/v1/cases/{case['id']}/evidence/{evidence['id']}"
        )
        assert removed.status_code == 204


def test_text_only_provider_rejects_case_with_image_evidence(
    authenticated_client: Client,
    tmp_path,
) -> None:
    _authenticate(authenticated_client)
    case = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Image capability check",
            "description": (
                "The attached screenshot is required to understand the reported behavior."
            ),
        },
        content_type="application/json",
    ).json()
    source = io.BytesIO()
    Image.new("RGB", (12, 12), color=(10, 20, 30)).save(source, format="PNG")
    with override_settings(MEDIA_ROOT=tmp_path):
        authenticated_client.post(
            f"/api/v1/cases/{case['id']}/evidence/images",
            data={"file": SimpleUploadedFile("evidence.png", source.getvalue(), "image/png")},
        )
        response = authenticated_client.post(
            f"/api/v1/cases/{case['id']}/assessments",
            data={"provider": "qwen", "intelligence": "fast"},
            content_type="application/json",
        )
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "MODEL_CAPABILITY_MISMATCH"


@override_settings(CASE_EVIDENCE_MAX_WORKSPACE_ITEMS=1)
def test_evidence_item_quota_is_enforced_across_cases(authenticated_client: Client) -> None:
    _authenticate(authenticated_client)
    first = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "First evidence case",
            "description": "This case consumes the workspace evidence item allowance.",
        },
        content_type="application/json",
    ).json()
    second = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Second evidence case",
            "description": "This case cannot reset the workspace evidence allowance.",
        },
        content_type="application/json",
    ).json()
    accepted = authenticated_client.post(
        f"/api/v1/cases/{first['id']}/evidence/text",
        data={"text": "The first bounded workspace item."},
        content_type="application/json",
    )
    rejected = authenticated_client.post(
        f"/api/v1/cases/{second['id']}/evidence/text",
        data={"text": "A second case does not reset the quota."},
        content_type="application/json",
    )

    assert accepted.status_code == 201
    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "EVIDENCE_WORKSPACE_LIMIT_REACHED"


def test_workspace_byte_quota_uses_normalized_stored_bytes(
    authenticated_client: Client,
    tmp_path,
) -> None:
    user = _authenticate(authenticated_client)
    existing_case = create_case(
        user=user,
        title="Existing stored evidence",
        description="This case already consumes the private workspace byte allowance.",
        summary="",
        disposition=OperationsCase.Disposition.UNCLASSIFIED,
        due_date=None,
        assignee_id=None,
    )
    CaseEvidence.objects.create(
        case=existing_case,
        created_by=user,
        kind=CaseEvidence.Kind.IMAGE,
        file="case-evidence/existing.png",
        original_filename="existing.png",
        mime_type="image/png",
        byte_size=100,
        width=1,
        height=1,
        sha256="a" * 64,
    )
    target = authenticated_client.post(
        "/api/v1/cases",
        data={
            "title": "Quota target case",
            "description": "The normalized upload would exceed the workspace byte allowance.",
        },
        content_type="application/json",
    ).json()
    source = io.BytesIO()
    Image.new("RGB", (2, 2), color=(10, 20, 30)).save(source, format="PNG")

    with override_settings(MEDIA_ROOT=tmp_path, CASE_EVIDENCE_MAX_WORKSPACE_BYTES=100):
        rejected = authenticated_client.post(
            f"/api/v1/cases/{target['id']}/evidence/images",
            data={"file": SimpleUploadedFile("new.png", source.getvalue(), "image/png")},
        )

    assert rejected.status_code == 409
    assert rejected.json()["error"]["code"] == "EVIDENCE_WORKSPACE_LIMIT_REACHED"
    assert CaseEvidence.objects.filter(case_id=target["id"]).count() == 0


def test_case_assessment_rejects_an_over_budget_image_set(
    authenticated_client: Client,
) -> None:
    user = _authenticate(authenticated_client)
    case = create_case(
        user=user,
        title="Too many screenshots",
        description="This case contains more images than one safe model request can analyze.",
        summary="",
        disposition=OperationsCase.Disposition.UNCLASSIFIED,
        due_date=None,
        assignee_id=None,
    )
    for index in range(9):
        CaseEvidence.objects.create(
            case=case,
            created_by=user,
            kind=CaseEvidence.Kind.IMAGE,
            file=f"case-evidence/image-{index}.png",
            original_filename=f"image-{index}.png",
            mime_type="image/png",
            byte_size=1,
            width=1,
            height=1,
            sha256=f"{index:064x}",
            sort_order=index,
        )

    response = authenticated_client.post(
        f"/api/v1/cases/{case.id}/assessments",
        data={"provider": "gemini", "intelligence": "fast"},
        content_type="application/json",
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ASSESSMENT_IMAGE_LIMIT_REACHED"
    assert not case.workflow_runs.exists()


@override_settings(CASE_EVIDENCE_MAX_BYTES=3)
def test_streaming_upload_handler_stops_before_oversized_file_is_parsed() -> None:
    handler = BoundedTemporaryFileUploadHandler()
    handler.new_file("file", "large.png", "image/png", None, None, None)
    try:
        assert handler.receive_data_chunk(b"123", 0) is None
        with pytest.raises(StopUpload):
            handler.receive_data_chunk(b"4", 3)
    finally:
        handler.file.close()
