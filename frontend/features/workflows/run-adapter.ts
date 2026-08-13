import {
  bugTriageOutputSchema,
  type BugTriageOutput,
} from "@/features/workflows/bug-triage/schema";
import {
  meetingActionsOutputSchema,
  type MeetingActionsOutput,
} from "@/features/workflows/meeting-actions/schema";
import {
  statusUpdateOutputSchema,
  type StatusUpdateOutput,
} from "@/features/workflows/status-update/schema";
import type { WorkflowRun } from "@/lib/api/types";
import type { DemoResult } from "@/lib/demo/run-demo";

export function runToResult(run: WorkflowRun): DemoResult | null {
  if (run.status !== "completed" || !run.result_json) return null;
  switch (run.workflow_id) {
    case "bug-triage":
      return {
        workflowId: run.workflow_id,
        output: bugTriageOutputSchema.parse(run.result_json) as BugTriageOutput,
      };
    case "meeting-actions":
      return {
        workflowId: run.workflow_id,
        output: meetingActionsOutputSchema.parse(run.result_json) as MeetingActionsOutput,
      };
    case "status-update":
      return {
        workflowId: run.workflow_id,
        output: statusUpdateOutputSchema.parse(run.result_json) as StatusUpdateOutput,
      };
  }
}
