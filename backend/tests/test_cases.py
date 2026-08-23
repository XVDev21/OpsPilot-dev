import io

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.files.uploadhandler import StopUpload
from django.test import Client, override_settings
from PIL import Image
from pydantic import BaseModel

from accounts.models import AppUser
from ai.providers.registry import ResolvedProvider
from ai.types import ProviderResult
from cases.models import (
    CaseAssessment,
    CaseEvent,
    CaseEvidence,
    OperationsCase,
    WorkspaceMember,
)
from cases.selectors import member_for_key
from cases.services import assign_case, create_case, record_case_event
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
