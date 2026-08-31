from cases.models import OperationsCase, WorkspaceInvitation, WorkspaceMember


def member_dict(member: WorkspaceMember | None) -> dict | None:
    if member is None:
        return None
    return {
        "id": member.id,
        "key": member.key,
        "name": member.name,
        "email": member.email,
        "initials": member.initials,
        "role": member.role,
        "discipline": member.discipline,
        "focus": member.focus,
        "availability": member.availability,
        "workflowFit": member.workflow_fit,
        "tone": member.tone,
        "isSample": member.is_sample,
        "linkedAccount": member.app_user_id is not None,
        "accessRole": member.access_role,
    }


def roster_member_dict(member: WorkspaceMember) -> dict:
    data = member_dict(member)
    assigned_case_count = getattr(member, "assigned_case_count", None)
    if assigned_case_count is None:
        assigned_case_count = member.case_assignments.exclude(
            case__status__in=[OperationsCase.Status.RESOLVED, OperationsCase.Status.CLOSED]
        ).count()
    open_task_count = getattr(member, "open_task_count", None)
    if open_task_count is None:
        open_task_count = member.work_items.exclude(status="done").count()
    data.update(
        {
            "membershipState": member.membership_state,
            "isActive": member.is_active,
            "workosManaged": bool(member.workos_membership_id),
            "joinedAt": member.joined_at,
            "assignedCaseCount": assigned_case_count,
            "openTaskCount": open_task_count,
        }
    )
    return data


def invitation_dict(invitation: WorkspaceInvitation) -> dict:
    return {
        "id": invitation.id,
        "email": invitation.email,
        "accessRole": invitation.access_role,
        "state": invitation.state,
        "targetMemberId": invitation.target_member_id,
        "targetMemberName": invitation.target_member.name if invitation.target_member else None,
        "expiresAt": invitation.expires_at,
        "acceptedAt": invitation.accepted_at,
        "revokedAt": invitation.revoked_at,
        "createdAt": invitation.created_at,
    }


def case_assignee(case: OperationsCase) -> WorkspaceMember | None:
    assignment = getattr(case, "assignment", None)
    return assignment.assignee if assignment else None


def case_summary_dict(case: OperationsCase) -> dict:
    work_item_count = getattr(case, "work_item_count", None)
    if work_item_count is None:
        work_item_count = case.work_items.count()
    completed_work_item_count = getattr(case, "completed_work_item_count", None)
    if completed_work_item_count is None:
        completed_work_item_count = case.work_items.filter(status="done").count()
    return {
        "id": case.id,
        "key": case.key,
        "title": case.title,
        "summary": case.summary,
        "intent": case.intent,
        "publicationState": case.publication_state,
        "status": case.status,
        "disposition": case.disposition,
        "confidence": case.confidence,
        "dueDate": case.due_date,
        "assignee": member_dict(case_assignee(case)),
        "workItemCount": work_item_count,
        "completedWorkItemCount": completed_work_item_count,
        "createdAt": case.created_at,
        "updatedAt": case.updated_at,
    }


def work_item_dict(item) -> dict:
    return {
        "id": item.id,
        "title": item.title,
        "description": item.description,
        "kind": item.kind,
        "status": item.status,
        "assignee": member_dict(item.assignee),
        "dueDate": item.due_date,
        "blockerReason": item.blocker_reason,
        "completedAt": item.completed_at,
        "sourceRunId": item.source_run_id,
        "sourceHandoffId": item.source_handoff_id,
        "createdAt": item.created_at,
        "updatedAt": item.updated_at,
    }


def case_detail_dict(case: OperationsCase) -> dict:
    data = case_summary_dict(case)
    data.update(
        {
            "description": case.description,
            "affectedArea": case.affected_area,
            "expectedOutcome": case.expected_outcome,
            "environmentContext": case.environment_context,
            "settingsContext": case.settings_context,
            "constraints": case.constraints,
            "publishedAt": case.published_at,
            "publishedAssessmentId": case.published_assessment_id,
            "resolutionSummary": case.resolution_summary,
            "resolvedAt": case.resolved_at,
            "closedAt": case.closed_at,
            "workflowRuns": [
                {
                    "id": run.id,
                    "workflowId": run.workflow_id,
                    "status": run.status,
                    "executionPhase": run.execution_phase,
                    "createdAt": run.created_at,
                    "completedAt": run.completed_at,
                }
                for run in case.visible_workflow_runs
            ],
            "evidence": [evidence_dict(item) for item in case.evidence.all()],
            "assessments": [assessment_dict(item) for item in case.assessments.all()],
            "workItems": [work_item_dict(item) for item in case.work_items.all()],
            "updates": [case_update_dict(item) for item in case.updates.all()],
            "events": [
                {
                    "id": event.id,
                    "type": event.event_type,
                    "actorName": _event_actor_name(event),
                    "payload": event.payload,
                    "createdAt": event.created_at,
                }
                for event in case.events.all()
            ],
        }
    )
    return data


def evidence_dict(item) -> dict:
    return {
        "id": item.id,
        "kind": item.kind,
        "text": item.text,
        "caption": item.caption,
        "originalFilename": item.original_filename,
        "mimeType": item.mime_type,
        "byteSize": item.byte_size,
        "width": item.width,
        "height": item.height,
        "downloadUrl": (
            f"/api/v1/cases/{item.case_id}/evidence/{item.id}/content"
            if item.kind == "image"
            else None
        ),
        "createdAt": item.created_at,
    }


def assessment_dict(item) -> dict:
    return {
        "id": item.id,
        "sequence": item.sequence,
        "sourceRunId": item.source_run_id,
        "provider": item.provider,
        "model": item.model,
        "intelligence": item.intelligence,
        "promptVersion": item.prompt_version,
        "result": item.result_json,
        "proposedDisposition": item.proposed_disposition,
        "modelConfidence": item.model_confidence,
        "decisionConfidence": item.decision_confidence,
        "confidenceBand": item.confidence_band,
        "confidenceFactors": item.confidence_factors,
        "isApplied": item.is_applied,
        "appliedAt": item.applied_at,
        "createdAt": item.created_at,
    }


def case_update_dict(item) -> dict:
    return {
        "id": item.id,
        "type": item.update_type,
        "body": item.body,
        "author": member_dict(item.author_member),
        "taskId": item.task_id,
        "externalLinks": item.external_links,
        "verificationResult": item.verification_result,
        "mentionedMembers": [member_dict(mention.member) for mention in item.mentions.all()],
        "attachments": [
            {
                "id": attachment.id,
                "originalFilename": attachment.original_filename,
                "mimeType": attachment.mime_type,
                "byteSize": attachment.byte_size,
                "width": attachment.width,
                "height": attachment.height,
                "downloadUrl": (
                    f"/api/v1/cases/{item.case_id}/updates/attachments/{attachment.id}/content"
                ),
            }
            for attachment in item.attachments.all()
        ],
        "createdAt": item.created_at,
    }


def _event_actor_name(event) -> str:
    if event.actor is None:
        return "OpsPilot"
    return event.actor.display_name or event.actor.email or "Workspace owner"
