import {
  bugTriageInputSchema,
  bugTriageOutputSchema,
  type BugTriageInput,
} from "@/features/workflows/bug-triage/schema";
import {
  meetingActionsInputSchema,
  meetingActionsOutputSchema,
  type MeetingActionsInput,
} from "@/features/workflows/meeting-actions/schema";
import {
  statusUpdateInputSchema,
  statusUpdateOutputSchema,
  type StatusUpdateInput,
} from "@/features/workflows/status-update/schema";
import type { WorkflowId } from "@/features/workflows/types";

export type DemoResult =
  | { workflowId: "bug-triage"; output: ReturnType<typeof makeBugResult> }
  | { workflowId: "meeting-actions"; output: ReturnType<typeof makeMeetingResult> }
  | { workflowId: "status-update"; output: ReturnType<typeof makeStatusResult> };

function sentence(value: string) {
  const trimmed = value.trim();
  const sentenceCased = `${trimmed.charAt(0).toUpperCase()}${trimmed.slice(1)}`;
  return /[.!?]$/.test(sentenceCased) ? sentenceCased : `${sentenceCased}.`;
}

function makeBugResult(input: BugTriageInput) {
  const affectedArea = input.affectedArea?.trim() || "the reported workflow";
  const expectedBehavior =
    input.expectedBehavior?.trim() || "Confirm the intended behavior with the workflow owner.";
  const evidence = input.evidence ?? [];
  const issueContext = [input.title, input.observedBehavior, input.settings]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const hasConfigurationSignal =
    /\b(setting|settings|configuration|configured|permission|permissions|role|roles|filter|feature flag)\b/.test(
      issueContext,
    );
  const hasProductDefectSignal =
    /\b(crash|crashes|crashed|error|errors|exception|fails|failed|failure|stalls|stalled|broken|timeout|500)\b/.test(
      issueContext,
    );
  const issueType =
    evidence.length >= 2 && hasProductDefectSignal
      ? "product-defect"
      : hasConfigurationSignal
        ? "configuration-or-process"
        : evidence.length >= 2
          ? "product-defect"
          : "needs-more-evidence";
  const team =
    issueType === "product-defect"
      ? "engineering"
      : issueType === "configuration-or-process"
        ? "support"
        : "operations";
  const routingRationale = {
    "product-defect": "The supplied evidence indicates repeatable product behavior that warrants technical validation.",
    "configuration-or-process":
      "The report contains a settings or permissions signal, so validate configuration before opening engineering work.",
    "needs-more-evidence":
      "The intake is useful but needs a repeatable case or another concrete signal before assigning a defect.",
  }[issueType];

  return bugTriageOutputSchema.parse({
    summary: `${input.title} affects ${affectedArea}. ${sentence(input.observedBehavior)}`,
    confirmedFacts: [
      ...(input.affectedArea ? [`Affected area: ${input.affectedArea}.`] : []),
      `Observed: ${sentence(input.observedBehavior)}`,
      ...evidence.map((item) => sentence(item.value)),
    ],
    evidenceGaps: [
      "No server-side logs, trace, or correlated request identifier was included.",
      "The smallest reliable reproduction case is not yet isolated.",
    ],
    likelyCategory:
      issueType === "product-defect"
        ? "Behavioral defect requiring technical validation"
        : issueType === "configuration-or-process"
          ? "Configuration or operating-process check"
          : "Unclassified report awaiting evidence",
    issueType,
    routing: {
      team,
      ownerId: input.triageOwnerId || null,
      rationale: routingRationale,
    },
    recommendedChecks: [
      `Reproduce the issue in ${affectedArea} using the smallest safe test case.`,
      "Correlate the browser observation with server logs or a trace identifier.",
      `Verify the expected outcome: ${sentence(expectedBehavior)}`,
    ],
    confidence: Math.min(
      0.9,
      0.44 +
        evidence.length * 0.07 +
        (input.expectedBehavior ? 0.05 : 0) +
        (input.affectedArea ? 0.04 : 0) +
        (input.inputMode === "advanced" ? 0.04 : 0),
    ),
    humanReviewNotice:
      "This deterministic demo organizes the supplied evidence; it does not diagnose production code. An engineer should validate the category and checks.",
  });
}

function prefixedLines(notes: string, prefix: string) {
  return notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().startsWith(`${prefix.toLowerCase()}:`))
    .map((line) => sentence(line.slice(line.indexOf(":") + 1).trim()));
}

function makeMeetingResult(input: MeetingActionsInput) {
  const decisions = prefixedLines(input.notes, "Decision");
  const openQuestions = prefixedLines(input.notes, "Open question");
  const actionLines = prefixedLines(input.notes, "Action");
  const participants = new Set(input.participants.map((participant) => participant.value));
  const actionItems = actionLines.map((line) => {
    const match = line.match(/^([^ ]+) will (.+?)(?: by ([^.]+))?\.$/i);
    const possibleOwner = match?.[1] ?? null;
    return {
      task: sentence(match?.[2] ?? line),
      owner: possibleOwner && participants.has(possibleOwner) ? possibleOwner : null,
      deadline: match?.[3] ?? null,
    };
  });

  return meetingActionsOutputSchema.parse({
    summary: `${input.title} produced ${decisions.length} recorded decision${decisions.length === 1 ? "" : "s"} and ${actionItems.length} follow-up item${actionItems.length === 1 ? "" : "s"}.`,
    decisions,
    actionItems,
    openQuestions,
    unresolvedItems:
      openQuestions.length > 0
        ? ["Open questions still require an explicit decision or owner."]
        : ["No open questions were explicitly labeled in the supplied notes."],
    followUpCoordinatorId: input.coordinatorId || null,
  });
}

function extractStatusLine(notes: string, prefix: string, fallback: string) {
  return prefixedLines(notes, prefix).length > 0 ? prefixedLines(notes, prefix) : [fallback];
}

function makeStatusResult(input: StatusUpdateInput) {
  const completed = extractStatusLine(
    input.notes,
    "Completed",
    "No completed item was explicitly labeled in the supplied notes.",
  );
  const inProgress = extractStatusLine(
    input.notes,
    "In progress",
    "Work is continuing based on the supplied notes.",
  );
  const blocked = extractStatusLine(
    input.notes,
    "Blocked",
    "No blocker was explicitly labeled in the supplied notes.",
  );
  const nextSteps = extractStatusLine(
    input.notes,
    "Next",
    "Confirm the next concrete milestone with the intended audience.",
  );

  const formatLead = {
    daily: "Daily update",
    manager: "Manager update",
    technical: "Technical update",
  }[input.format];
  const audienceLabel = {
    team: "the team",
    manager: "your manager",
    stakeholders: "stakeholders",
  }[input.audience];

  return statusUpdateOutputSchema.parse({
    authorId: input.authorId || null,
    completed,
    inProgress,
    blocked,
    nextSteps,
    shareableUpdate: `${formatLead} for ${audienceLabel}. Completed: ${completed.join(" ")} In progress: ${inProgress.join(" ")} Blocked or waiting: ${blocked.join(" ")} Next: ${nextSteps.join(" ")}`,
  });
}

export function runDemoWorkflow(workflowId: WorkflowId, input: unknown): DemoResult {
  switch (workflowId) {
    case "bug-triage": {
      const parsed = bugTriageInputSchema.parse(input);
      return { workflowId, output: makeBugResult(parsed) };
    }
    case "meeting-actions": {
      const parsed = meetingActionsInputSchema.parse(input);
      return { workflowId, output: makeMeetingResult(parsed) };
    }
    case "status-update": {
      const parsed = statusUpdateInputSchema.parse(input);
      return { workflowId, output: makeStatusResult(parsed) };
    }
  }
}
