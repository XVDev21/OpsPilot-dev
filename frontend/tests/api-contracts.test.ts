import { describe, expect, it } from "vitest";
import { runToResult } from "@/features/workflows/run-adapter";
import { ApiError } from "@/lib/api/errors";
import {
  backendRunListSchema,
  parseApiResponse,
  workflowRunSchema,
} from "@/lib/api/schemas";
import { bugTriageSampleOutput } from "@/features/workflows/bug-triage/schema";

const completedRun = {
  id: "run_123",
  workflow_id: "bug-triage",
  status: "completed",
  input_json: { title: "Export stalls" },
  result_json: bugTriageSampleOutput,
  error_code: null,
  provider: "gemini",
  model: "gemini-test",
  duration_ms: 842,
  created_at: "2026-08-13T02:30:00Z",
  completed_at: "2026-08-13T02:30:01Z",
};

describe("live API contracts", () => {
  it("accepts the canonical workflow run shape", () => {
    expect(workflowRunSchema.parse(completedRun)).toMatchObject({
      id: "run_123",
      workflow_id: "bug-triage",
      status: "completed",
    });
  });

  it("normalizes either backend history collection shape", () => {
    expect(backendRunListSchema.parse([completedRun])).toHaveLength(1);
    expect(backendRunListSchema.parse({ items: [completedRun] })).toHaveProperty("items");
  });

  it("turns contract drift into a retryable API error", () => {
    expect(() =>
      parseApiResponse(workflowRunSchema, { ...completedRun, workflow_id: "freeform-prompt" }),
    ).toThrowError(ApiError);

    try {
      parseApiResponse(workflowRunSchema, { ...completedRun, workflow_id: "freeform-prompt" });
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_API_RESPONSE", status: 502, retryable: true });
    }
  });

  it("reuses the final workflow result contract for live runs", () => {
    const result = runToResult(workflowRunSchema.parse(completedRun));
    expect(result).toEqual({ workflowId: "bug-triage", output: bugTriageSampleOutput });
  });
});
