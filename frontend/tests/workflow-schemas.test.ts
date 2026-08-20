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
    if (result.workflowId === "bug-triage") {
      expect(result.output.issueType).toBe("product-defect");
      expect(result.output.routing.team).toBe("engineering");
    }
  });

  it("keeps Simple Mode valid and routes settings issues away from engineering", () => {
    const simpleInput = {
      inputMode: "simple" as const,
      title: "Dashboard filter looks unavailable",
      observedBehavior: "A team member cannot see the saved filter after their role settings changed.",
      affectedArea: "",
      expectedBehavior: "",
      evidence: [],
      settings: "Role permissions were recently updated.",
      constraints: "",
      triageOwnerId: "",
    };

    expect(bugTriageInputSchema.safeParse(simpleInput).success).toBe(true);
    const result = runDemoWorkflow("bug-triage", simpleInput);
    if (result.workflowId === "bug-triage") {
      expect(result.output.issueType).toBe("configuration-or-process");
      expect(result.output.routing.team).toBe("support");
    }
  });

  it("routes an evidenced settings-page failure to engineering", () => {
    const result = runDemoWorkflow("bug-triage", {
      inputMode: "advanced",
      title: "Settings page crashes after save",
      observedBehavior: "Saving a valid notification setting crashes the page with a server error.",
      affectedArea: "Notification settings",
      expectedBehavior: "The setting should save without an error.",
      evidence: [
        { value: "Reproduced twice in a test workspace." },
        { value: "The request consistently returns HTTP 500." },
      ],
      settings: "Default notification policy",
      constraints: "Do not test in production.",
      triageOwnerId: "sample-theo-bennett",
    });

    if (result.workflowId === "bug-triage") {
      expect(result.output.issueType).toBe("product-defect");
      expect(result.output.routing.team).toBe("engineering");
    }
  });

  it("validates deterministic meeting output and preserves supported owners", () => {
    const result = runDemoWorkflow("meeting-actions", meetingActionsSampleInput);
    expect(meetingActionsOutputSchema.safeParse(result.output).success).toBe(true);
    if (result.workflowId === "meeting-actions") {
      expect(result.output.actionItems[0]?.owner).toBe("Maya");
      expect(result.output.followUpCoordinatorId).toBe("sample-amelia-cruz");
    }
  });

  it("validates deterministic status output", () => {
    const result = runDemoWorkflow("status-update", statusUpdateSampleInput);
    expect(statusUpdateOutputSchema.safeParse(result.output).success).toBe(true);
    if (result.workflowId === "status-update") {
      expect(result.output.authorId).toBe("sample-mina-park");
    }
  });
});
