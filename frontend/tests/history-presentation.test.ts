import { describe, expect, it } from "vitest";
import { runDate, runPreview, runTitle } from "@/features/history/presentation";
import type { WorkflowRun } from "@/lib/api/types";

function makeRun(overrides: Partial<WorkflowRun> = {}): WorkflowRun {
  return {
    id: "run_123",
    workflow_id: "meeting-actions",
    status: "completed",
    input_json: { title: "Quarterly planning" },
    result_json: { summary: "Owners and deadlines are ready." },
    error_code: null,
    provider: null,
    model: null,
    intelligence: null,
    prompt_version: null,
    input_tokens: null,
    output_tokens: null,
    duration_ms: null,
    created_at: "2026-08-13T02:30:00Z",
    completed_at: "2026-08-13T02:30:01Z",
    expires_at: null,
    ...overrides,
  };
}

describe("history presentation", () => {
  it("derives a human title and concise result preview", () => {
    const run = makeRun();
    expect(runTitle(run)).toBe("Quarterly planning");
    expect(runPreview(run)).toBe("Owners and deadlines are ready.");
  });

  it("uses the status update audience in its title", () => {
    expect(
      runTitle(
        makeRun({ workflow_id: "status-update", input_json: { audience: "Leadership" } }),
      ),
    ).toBe("Status update for Leadership");
  });

  it("explains failed runs without leaking raw formatting", () => {
    expect(runPreview(makeRun({ status: "failed", error_code: "AI_RATE_LIMIT" }))).toBe(
      "Run failed: ai rate limit.",
    );
  });

  it("handles malformed timestamps safely", () => {
    expect(runDate("not-a-date")).toBe("Unknown time");
  });
});
