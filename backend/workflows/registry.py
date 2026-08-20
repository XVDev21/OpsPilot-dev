from dataclasses import dataclass

from ninja import Schema

from workflows.schemas import (
    BugTriageInput,
    BugTriageOutput,
    MeetingActionsInput,
    MeetingActionsOutput,
    StatusUpdateInput,
    StatusUpdateOutput,
)

type WorkflowId = str


@dataclass(frozen=True)
class WorkflowDefinition:
    id: WorkflowId
    title: str
    short_title: str
    category: str
    description: str
    benefit: str
    input_schema: type[Schema]
    output_schema: type[Schema]
    prompt_instructions: str
    prompt_version: str = "v3-team-routing"

    def metadata(self) -> dict[str, str]:
        return {
            "id": self.id,
            "title": self.title,
            "shortTitle": self.short_title,
            "category": self.category,
            "description": self.description,
            "benefit": self.benefit,
            "promptVersion": self.prompt_version,
        }


WORKFLOW_REGISTRY: dict[WorkflowId, WorkflowDefinition] = {
    "bug-triage": WorkflowDefinition(
        id="bug-triage",
        title="Bug / Issue Triage",
        short_title="Bug Triage",
        category="Technical",
        description="Turn scattered reports and known evidence into a reviewable triage brief.",
        benefit="Move from symptom collection to a focused investigation plan.",
        input_schema=BugTriageInput,
        output_schema=BugTriageOutput,
        prompt_instructions=(
            "Create an evidence-bound issue triage brief. Never state a root cause as confirmed "
            "unless the supplied evidence proves it. Classify the report as product-defect, "
            "configuration-or-process, or needs-more-evidence. Route product defects to "
            "engineering, configuration or settings issues to support, and unclear reports to "
            "operations. Separate "
            "confirmed facts from gaps, make checks specific and safe, and only echo a supplied "
            "triageOwnerId; never invent a collaborator identifier."
        ),
    ),
    "meeting-actions": WorkflowDefinition(
        id="meeting-actions",
        title="Meeting → Action Items",
        short_title="Meeting Actions",
        category="Collaboration",
        description="Convert working notes into decisions, follow-ups, and unresolved questions.",
        benefit="Leave the meeting with work people can actually pick up.",
        input_schema=MeetingActionsInput,
        output_schema=MeetingActionsOutput,
        prompt_instructions=(
            "Extract decisions and action items only from the supplied notes. Set an owner or "
            "deadline only when the notes explicitly support it; otherwise use null. Preserve "
            "unresolved ambiguity as an open question or unresolved item. Only echo a supplied "
            "coordinatorId as followUpCoordinatorId; never invent a collaborator identifier."
        ),
    ),
    "status-update": WorkflowDefinition(
        id="status-update",
        title="Work → Status Update",
        short_title="Status Update",
        category="Operations",
        description="Shape rough progress notes into an audience-appropriate status update.",
        benefit="Share progress without rebuilding the same update every day.",
        input_schema=StatusUpdateInput,
        output_schema=StatusUpdateOutput,
        prompt_instructions=(
            "Transform the supplied notes into an accurate status update for the requested "
            "audience and format. Never describe ongoing work as completed. Keep blockers and "
            "next steps distinct, and make the shareable update concise. Only echo a supplied "
            "authorId; never invent a collaborator identifier."
        ),
    ),
}


def get_workflow(workflow_id: str) -> WorkflowDefinition | None:
    return WORKFLOW_REGISTRY.get(workflow_id)
