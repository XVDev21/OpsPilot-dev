import type { BugTriageOutput } from "@/features/workflows/bug-triage/schema";
import type { MeetingActionsOutput } from "@/features/workflows/meeting-actions/schema";
import { BugResult, MeetingResult, StatusResult } from "@/features/workflows/result-panels";
import type { StatusUpdateOutput } from "@/features/workflows/status-update/schema";
import type { DemoResult } from "@/lib/demo/run-demo";

export function resultToText(result: DemoResult) {
  return JSON.stringify(result.output, null, 2);
}

export function WorkflowResultContent({ result, sourceRunId = null, mode = "demo" }: { result: DemoResult; sourceRunId?: string | null; mode?: "live" | "demo" }) {
  switch (result.workflowId) {
    case "bug-triage":
      return <BugResult output={result.output as BugTriageOutput} sourceRunId={sourceRunId} mode={mode} />;
    case "meeting-actions":
      return <MeetingResult output={result.output as MeetingActionsOutput} />;
    case "status-update":
      return <StatusResult output={result.output as StatusUpdateOutput} />;
  }
}
