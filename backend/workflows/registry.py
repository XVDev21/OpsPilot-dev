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
    prompt_version: str = "v1"

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
    ),
}


def get_workflow(workflow_id: str) -> WorkflowDefinition | None:
    return WORKFLOW_REGISTRY.get(workflow_id)
