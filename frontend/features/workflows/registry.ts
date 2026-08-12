import {
  bugTriageInputSchema,
  bugTriageOutputSchema,
  bugTriageSampleInput,
  bugTriageSampleOutput,
} from "@/features/workflows/bug-triage/schema";
import {
  meetingActionsInputSchema,
  meetingActionsOutputSchema,
  meetingActionsSampleInput,
  meetingActionsSampleOutput,
} from "@/features/workflows/meeting-actions/schema";
import {
  statusUpdateInputSchema,
  statusUpdateOutputSchema,
  statusUpdateSampleInput,
  statusUpdateSampleOutput,
} from "@/features/workflows/status-update/schema";
import type { WorkflowDefinition, WorkflowId } from "@/features/workflows/types";

export const workflows = [
  {
    id: "bug-triage",
    title: "Bug / Issue Triage",
    shortTitle: "Bug Triage",
    category: "Technical",
    description:
      "Turn scattered reports and known evidence into a reviewable first-pass triage brief.",
    benefit: "Move from symptom collection to a focused investigation plan.",
    problem:
      "Issue reports often mix facts, assumptions, missing evidence, and suggested fixes in one hard-to-scan thread.",
    ctaLabel: "Run demo triage",
    icon: "bug",
    tone: "indigo",
    inputSchema: bugTriageInputSchema,
    outputSchema: bugTriageOutputSchema,
    sampleInput: bugTriageSampleInput,
    sampleOutput: bugTriageSampleOutput,
    inputPreview: ["Observed behavior", "Known evidence", "Expected behavior"],
    resultPreview: ["Confirmed facts", "Evidence gaps", "Recommended checks"],
  },
  {
    id: "meeting-actions",
    title: "Meeting → Action Items",
    shortTitle: "Meeting Actions",
    category: "Collaboration",
    description:
      "Convert working notes into decisions, owned follow-ups, and unresolved questions.",
    benefit: "Leave the meeting with work people can actually pick up.",
    problem:
      "The useful commitments in a meeting are easy to lose inside chronological notes and conversational context.",
    ctaLabel: "Run demo extraction",
    icon: "meeting",
    tone: "cyan",
    inputSchema: meetingActionsInputSchema,
    outputSchema: meetingActionsOutputSchema,
    sampleInput: meetingActionsSampleInput,
    sampleOutput: meetingActionsSampleOutput,
    inputPreview: ["Meeting notes", "Participants", "Date"],
    resultPreview: ["Decisions", "Action items", "Open questions"],
  },
  {
    id: "status-update",
    title: "Work → Status Update",
    shortTitle: "Status Update",
    category: "Operations",
    description:
      "Shape rough progress notes into a concise update matched to the audience and format.",
    benefit: "Share progress without rebuilding the same update every day.",
    problem:
      "Useful delivery context lives across fragments, while every audience expects a different level of detail.",
    ctaLabel: "Run demo update",
    icon: "status",
    tone: "amber",
    inputSchema: statusUpdateInputSchema,
    outputSchema: statusUpdateOutputSchema,
    sampleInput: statusUpdateSampleInput,
    sampleOutput: statusUpdateSampleOutput,
    inputPreview: ["Rough work notes", "Audience", "Update format"],
    resultPreview: ["Completed", "In progress", "Next steps"],
  },
] as const satisfies readonly WorkflowDefinition[];

export function isWorkflowId(value: string): value is WorkflowId {
  return workflows.some((workflow) => workflow.id === value);
}

export function getWorkflow(id: WorkflowId) {
  return workflows.find((workflow) => workflow.id === id)!;
}
