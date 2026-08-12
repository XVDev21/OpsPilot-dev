"use client";

import { motion, useReducedMotion } from "motion/react";
import { FileCheck2, LockKeyhole } from "lucide-react";
import { useState } from "react";
import { BugTriageForm } from "@/features/workflows/bug-triage/form";
import type { BugTriageInput, BugTriageOutput } from "@/features/workflows/bug-triage/schema";
import { CopyResultButton } from "@/features/workflows/copy-result-button";
import { MeetingActionsForm } from "@/features/workflows/meeting-actions/form";
import type {
  MeetingActionsInput,
  MeetingActionsOutput,
} from "@/features/workflows/meeting-actions/schema";
import { BugResult, MeetingResult, StatusResult } from "@/features/workflows/result-panels";
import { StatusUpdateForm } from "@/features/workflows/status-update/form";
import type { StatusUpdateInput, StatusUpdateOutput } from "@/features/workflows/status-update/schema";
import type { WorkflowId } from "@/features/workflows/types";
import { runDemoWorkflow, type DemoResult } from "@/lib/demo/run-demo";

function resultToText(result: DemoResult) {
  return JSON.stringify(result.output, null, 2);
}

function WorkflowForm({
  workflowId,
  onResult,
}: {
  workflowId: WorkflowId;
  onResult: (result: DemoResult) => void;
}) {
  if (workflowId === "bug-triage") {
    return (
      <BugTriageForm
        onSubmitResult={(input: BugTriageInput) => onResult(runDemoWorkflow(workflowId, input))}
      />
    );
  }
  if (workflowId === "meeting-actions") {
    return (
      <MeetingActionsForm
        onSubmitResult={(input: MeetingActionsInput) => onResult(runDemoWorkflow(workflowId, input))}
      />
    );
  }
  return (
    <StatusUpdateForm
      onSubmitResult={(input: StatusUpdateInput) => onResult(runDemoWorkflow(workflowId, input))}
    />
  );
}

function ResultContent({ result }: { result: DemoResult }) {
  switch (result.workflowId) {
    case "bug-triage":
      return <BugResult output={result.output as BugTriageOutput} />;
    case "meeting-actions":
      return <MeetingResult output={result.output as MeetingActionsOutput} />;
    case "status-update":
      return <StatusResult output={result.output as StatusUpdateOutput} />;
  }
}

export function WorkflowRunner({ workflowId }: { workflowId: WorkflowId }) {
  const [result, setResult] = useState<DemoResult | null>(null);
  const reduceMotion = useReducedMotion();

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.88fr)]">
      <WorkflowForm workflowId={workflowId} onResult={setResult} />

      <section
        aria-label="Workflow result"
        className="rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)] xl:sticky xl:top-24"
      >
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">Result</p>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground">
              Structured artifact
            </h2>
            <p className="mt-1 text-sm leading-6 text-foreground-muted">
              The same result surface is ready for live mode later.
            </p>
          </div>
          {result ? <CopyResultButton text={resultToText(result)} /> : null}
        </div>

        {result ? (
          <motion.div
            key={JSON.stringify(result.output)}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="p-5 sm:p-6"
            role="status"
            aria-live="polite"
          >
            <ResultContent result={result} />
          </motion.div>
        ) : (
          <div className="paper-grid m-4 min-h-80 rounded-2xl border border-dashed border-border-strong p-5 sm:m-5 sm:p-6">
            <div className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
              <FileCheck2 aria-hidden="true" className="size-5" />
            </div>
            <h3 className="mt-6 text-base font-bold text-foreground">Ready when your input is</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-foreground-muted">
              Complete the required fields or load the sample, then run the deterministic workflow. There is no provider request or artificial wait.
            </p>
            <div className="mt-8 grid gap-2">
              {["Summary", "Structured sections", "Copy-ready output"].map((label, index) => (
                <div key={label} className="flex items-center gap-3 rounded-xl border border-border bg-surface-raised/88 p-3">
                  <span className="font-mono text-[0.6875rem] font-bold text-foreground-soft">0{index + 1}</span>
                  <span className="text-xs font-semibold text-foreground-muted">{label}</span>
                </div>
              ))}
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-foreground-soft">
              <LockKeyhole aria-hidden="true" className="size-3.5" /> Input is not persisted automatically.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
