import { getWorkflow } from "@/features/workflows/registry";
import type { WorkflowRun } from "@/lib/api/types";

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function runTitle(run: WorkflowRun) {
  const input = record(run.input_json);
  if (run.workflow_id === "status-update") {
    const audience = text(input?.audience);
    return audience ? `Status update for ${audience}` : "Work status update";
  }
  return text(input?.title) ?? getWorkflow(run.workflow_id).title;
}

export function runPreview(run: WorkflowRun) {
  if (run.status === "pending") return "Structured result is still being generated.";
  if (run.status === "failed") return run.error_code ? `Run failed: ${run.error_code.replaceAll("_", " ").toLowerCase()}.` : "Run did not produce a result.";
  const output = record(run.result_json);
  return text(output?.summary) ?? text(output?.shareableUpdate) ?? "Structured result is ready to review.";
}

const dateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function runDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown time" : dateFormatter.format(date);
}
