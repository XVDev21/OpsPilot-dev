"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, FileCheck2, LoaderCircle, LockKeyhole, RefreshCcw } from "lucide-react";
import { useState } from "react";
import {
  useAppMode,
  type AIProvider,
  type AppMode,
  type IntelligenceLevel,
} from "@/components/providers/app-mode-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BugTriageForm } from "@/features/workflows/bug-triage/form";
import type { BugTriageInput } from "@/features/workflows/bug-triage/schema";
import { CopyResultButton } from "@/features/workflows/copy-result-button";
import { MeetingActionsForm } from "@/features/workflows/meeting-actions/form";
import type { MeetingActionsInput } from "@/features/workflows/meeting-actions/schema";
import { runToResult } from "@/features/workflows/run-adapter";
import { StatusUpdateForm } from "@/features/workflows/status-update/form";
import type { StatusUpdateInput } from "@/features/workflows/status-update/schema";
import type { WorkflowId } from "@/features/workflows/types";
import { resultToText, WorkflowResultContent } from "@/features/workflows/workflow-result";
import { browserApi } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import { runDemoWorkflow, type DemoResult } from "@/lib/demo/run-demo";

type WorkflowInput = BugTriageInput | MeetingActionsInput | StatusUpdateInput;
type RunMetadata = {
  provider: AIProvider;
  intelligence: IntelligenceLevel;
  inputTokens: number | null;
  outputTokens: number | null;
};

const providerLabels: Record<AIProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  qwen: "Qwen",
};
const intelligenceLabels: Record<IntelligenceLevel, string> = {
  fast: "Efficient",
  balanced: "Balanced",
  high: "Deep",
};

function WorkflowForm({
  workflowId,
  mode,
  onSubmit,
}: {
  workflowId: WorkflowId;
  mode: AppMode;
  onSubmit: (input: WorkflowInput) => Promise<void>;
}) {
  if (workflowId === "bug-triage") {
    return <BugTriageForm mode={mode} onSubmitResult={onSubmit} />;
  }
  if (workflowId === "meeting-actions") {
    return <MeetingActionsForm mode={mode} onSubmitResult={onSubmit} />;
  }
  return <StatusUpdateForm mode={mode} onSubmitResult={onSubmit} />;
}

function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry: (() => void) | null }) {
  return (
    <div className="m-4 rounded-2xl border border-danger/25 bg-danger/8 p-5 sm:m-5 sm:p-6" role="alert">
      <span className="grid size-11 place-items-center rounded-xl bg-danger/12 text-danger">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-5 text-base font-bold text-foreground">Live run could not finish</h3>
      <p className="mt-2 text-sm leading-6 text-foreground-muted">{error.message}</p>
      {error.requestId ? (
        <details className="mt-4 text-xs text-foreground-soft">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Technical details</summary>
          <p className="font-mono">Request ID: {error.requestId}</p>
        </details>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {error.retryable && onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RefreshCcw aria-hidden="true" className="size-4" /> Retry live run
          </Button>
        ) : null}
        <p className="self-center text-xs text-foreground-soft">
          Your form input is preserved. Demo Mode is available from Settings.
        </p>
      </div>
    </div>
  );
}

function WorkflowRunnerCore({
  workflowId,
  mode,
  provider,
  intelligence,
}: {
  workflowId: WorkflowId;
  mode: AppMode;
  provider: AIProvider;
  intelligence: IntelligenceLevel;
}) {
  const [result, setResult] = useState<DemoResult | null>(null);
  const [runMetadata, setRunMetadata] = useState<RunMetadata | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastInput, setLastInput] = useState<WorkflowInput | null>(null);
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const liveMutation = useMutation({
    mutationFn: (input: WorkflowInput) =>
      browserApi.createRun(workflowId, input, { provider, intelligence }),
  });

  async function execute(input: WorkflowInput) {
    setLastInput(input);
    setError(null);
    if (mode === "demo") {
      setRunMetadata(null);
      setResult(runDemoWorkflow(workflowId, input));
      return;
    }

    setResult(null);
    try {
      const run = await liveMutation.mutateAsync(input);
      const nextResult = runToResult(run);
      if (!nextResult) {
        throw new ApiError({
          code: "INVALID_AI_OUTPUT",
          message: "The live run finished without a valid structured result.",
          requestId: null,
          retryable: true,
        }, 502);
      }
      setResult(nextResult);
      setRunMetadata({
        provider,
        intelligence,
        inputTokens: run.input_tokens,
        outputTokens: run.output_tokens,
      });
      await queryClient.invalidateQueries({ queryKey: ["runs"] });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught
          : new ApiError({
              code: "API_REQUEST_FAILED",
              message: "The live run could not be completed.",
              retryable: true,
            }),
      );
    }
  }

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.88fr)]">
      <WorkflowForm workflowId={workflowId} mode={mode} onSubmit={execute} />

      <section
        aria-label="Workflow result"
        className="rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)] xl:sticky xl:top-24"
      >
        <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">Result</p>
              <Badge tone={mode === "live" ? "success" : "primary"}>{mode}</Badge>
            </div>
            <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground">
              Structured artifact
            </h2>
            <p className="mt-1 text-sm leading-6 text-foreground-muted">
              {mode === "live"
                ? "Authenticated results are validated by the API before display."
                : "Deterministic output uses the same production result component."}
            </p>
            {mode === "live" ? (
              <p className="mt-2 text-xs font-semibold text-foreground-soft">
                {providerLabels[provider]} · {intelligenceLabels[intelligence]}
                {runMetadata && runMetadata.inputTokens !== null && runMetadata.outputTokens !== null
                  ? ` · ${(runMetadata.inputTokens + runMetadata.outputTokens).toLocaleString()} tokens`
                  : ""}
              </p>
            ) : null}
          </div>
          {result ? <CopyResultButton text={resultToText(result)} /> : null}
        </div>

        {liveMutation.isPending ? (
          <div className="m-4 rounded-2xl border border-primary/20 bg-surface-accent p-5 sm:m-5 sm:p-6" role="status" aria-live="polite">
            <LoaderCircle aria-hidden="true" className="size-6 animate-spin text-primary motion-reduce:animate-none" />
            <h3 className="mt-5 text-base font-bold text-foreground">Generating a structured result</h3>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              Your validated input has been submitted. OpsPilot is waiting for the live API response.
            </p>
          </div>
        ) : error ? (
          <ErrorPanel error={error} onRetry={lastInput ? () => void execute(lastInput) : null} />
        ) : result ? (
          <motion.div
            key={JSON.stringify(result.output)}
            initial={reduceMotion ? false : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.36, ease: [0.16, 1, 0.3, 1] }}
            className="p-5 sm:p-6"
            role="status"
            aria-live="polite"
          >
            <WorkflowResultContent result={result} />
          </motion.div>
        ) : (
          <div className="paper-grid m-4 min-h-80 rounded-2xl border border-dashed border-border-strong p-5 sm:m-5 sm:p-6">
            <div className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
              <FileCheck2 aria-hidden="true" className="size-5" />
            </div>
            <h3 className="mt-6 text-base font-bold text-foreground">Ready when your input is</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-foreground-muted">
              {mode === "live"
                ? "Complete the required fields, then submit an authenticated run to the Django API."
                : "Complete the required fields or load the sample, then run the deterministic workflow locally."}
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
              <LockKeyhole aria-hidden="true" className="size-3.5" />
              {mode === "live" ? "Access tokens stay in the encrypted server session." : "Demo input is not persisted automatically."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

export function ManagedWorkflowRunner({ workflowId }: { workflowId: WorkflowId }) {
  const { mode, provider, intelligence } = useAppMode();
  return (
    <WorkflowRunnerCore
      key={`${mode}:${provider}:${intelligence}`}
      workflowId={workflowId}
      mode={mode}
      provider={provider}
      intelligence={intelligence}
    />
  );
}

export function DemoWorkflowRunner({ workflowId }: { workflowId: WorkflowId }) {
  return (
    <WorkflowRunnerCore
      workflowId={workflowId}
      mode="demo"
      provider="gemini"
      intelligence="fast"
    />
  );
}
