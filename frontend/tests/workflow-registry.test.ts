import { describe, expect, it } from "vitest";
import { getWorkflow, isWorkflowId, workflows } from "@/features/workflows/registry";

describe("workflow registry", () => {
  it("contains exactly the three implemented workflows", () => {
    expect(workflows.map((workflow) => workflow.id)).toEqual([
      "bug-triage",
      "meeting-actions",
      "status-update",
    ]);
  });

  it("exposes complete launch metadata and valid sample contracts", () => {
    for (const workflow of workflows) {
      expect(workflow.title).toBeTruthy();
      expect(workflow.ctaLabel).toMatch(/^Run demo/);
      expect(workflow.inputSchema.safeParse(workflow.sampleInput).success).toBe(true);
      expect(workflow.outputSchema.safeParse(workflow.sampleOutput).success).toBe(true);
      expect(getWorkflow(workflow.id)).toBe(workflow);
    }
  });

  it("rejects unknown workflow identifiers", () => {
    expect(isWorkflowId("future-workflow")).toBe(false);
  });
});
