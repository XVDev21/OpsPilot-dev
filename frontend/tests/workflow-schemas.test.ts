import { describe, expect, it } from "vitest";
import {
  bugTriageInputSchema,
  bugTriageOutputSchema,
  bugTriageSampleInput,
} from "@/features/workflows/bug-triage/schema";
import {
  meetingActionsInputSchema,
  meetingActionsOutputSchema,
  meetingActionsSampleInput,
} from "@/features/workflows/meeting-actions/schema";
import {
  statusUpdateInputSchema,
  statusUpdateOutputSchema,
  statusUpdateSampleInput,
} from "@/features/workflows/status-update/schema";
import { runDemoWorkflow } from "@/lib/demo/run-demo";

describe("workflow schemas", () => {
  it("rejects incomplete inputs", () => {
    expect(bugTriageInputSchema.safeParse({}).success).toBe(false);
    expect(meetingActionsInputSchema.safeParse({ title: "Sync", notes: "short" }).success).toBe(false);
    expect(statusUpdateInputSchema.safeParse({ notes: "short" }).success).toBe(false);
  });

  it("validates deterministic bug triage output", () => {
    const result = runDemoWorkflow("bug-triage", bugTriageSampleInput);
    expect(result.workflowId).toBe("bug-triage");
    expect(bugTriageOutputSchema.safeParse(result.output).success).toBe(true);
  });

  it("validates deterministic meeting output and preserves supported owners", () => {
    const result = runDemoWorkflow("meeting-actions", meetingActionsSampleInput);
    expect(meetingActionsOutputSchema.safeParse(result.output).success).toBe(true);
    if (result.workflowId === "meeting-actions") {
      expect(result.output.actionItems[0]?.owner).toBe("Maya");
    }
  });

  it("validates deterministic status output", () => {
    const result = runDemoWorkflow("status-update", statusUpdateSampleInput);
    expect(statusUpdateOutputSchema.safeParse(result.output).success).toBe(true);
  });
});
