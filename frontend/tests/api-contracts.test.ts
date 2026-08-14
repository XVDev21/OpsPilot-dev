import { describe, expect, it } from "vitest";
import currentUserFixture from "../../contracts/v1/current-user.json";
import executionOptionsFixture from "../../contracts/v1/execution-options.json";
import runListFixture from "../../contracts/v1/run-list.json";
import workflowRunFixture from "../../contracts/v1/workflow-run.json";
import { runToResult } from "@/features/workflows/run-adapter";
import { ApiError } from "@/lib/api/errors";
import {
  backendRunListSchema,
  backendUserSchema,
  executionOptionsSchema,
  parseApiResponse,
  runListResponseSchema,
  workflowRunSchema,
} from "@/lib/api/schemas";

describe("live API contracts", () => {
  it("accepts the shared current-user and workflow-run fixtures", () => {
    expect(backendUserSchema.parse(currentUserFixture)).toMatchObject({
      workos_user_id: "user_contract_fixture",
    });
    expect(workflowRunSchema.parse(workflowRunFixture)).toMatchObject({
      id: "21d9f642-97fc-42cf-9028-d51a5388a99b",
      workflow_id: "bug-triage",
      status: "completed",
    });
  });

  it("accepts the shared paginated history fixture", () => {
    expect(runListResponseSchema.parse(runListFixture)).toHaveProperty("items");
    expect(backendRunListSchema.parse(runListFixture)).toHaveProperty("items");
  });

  it("accepts server-owned provider and intelligence options", () => {
    expect(executionOptionsSchema.parse(executionOptionsFixture)).toMatchObject({
      defaultProvider: "gemini",
      defaultIntelligence: "fast",
      retentionDays: 30,
    });
  });

  it("turns contract drift into a retryable API error", () => {
    expect(() =>
      parseApiResponse(workflowRunSchema, {
        ...workflowRunFixture,
        workflow_id: "freeform-prompt",
      }),
    ).toThrowError(ApiError);

    try {
      parseApiResponse(workflowRunSchema, {
        ...workflowRunFixture,
        workflow_id: "freeform-prompt",
      });
    } catch (error) {
      expect(error).toMatchObject({ code: "INVALID_API_RESPONSE", status: 502, retryable: true });
    }
  });

  it("reuses the final workflow result contract for live runs", () => {
    const run = workflowRunSchema.parse(workflowRunFixture);
    const result = runToResult(run);
    expect(result).toEqual({ workflowId: "bug-triage", output: run.result_json });
  });
});
