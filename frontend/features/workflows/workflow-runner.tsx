"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "motion/react";
import { AlertTriangle, FileCheck2, LoaderCircle, LockKeyhole, LogIn, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  useAppMode,
  type AIProvider,
  type AppMode,
  type IntelligenceLevel,
} from "@/components/providers/app-mode-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BugTriageForm } from "@/features/workflows/bug-triage/form";
import { bugTriageInputSchema, type BugTriageInput } from "@/features/workflows/bug-triage/schema";
import { CopyResultButton } from "@/features/workflows/copy-result-button";
import { MeetingActionsForm } from "@/features/workflows/meeting-actions/form";
import { meetingActionsInputSchema, type MeetingActionsInput } from "@/features/workflows/meeting-actions/schema";
import { runToResult } from "@/features/workflows/run-adapter";
import { StatusUpdateForm } from "@/features/workflows/status-update/form";
import { statusUpdateInputSchema, type StatusUpdateInput } from "@/features/workflows/status-update/schema";
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
  runId: string;
};

const providerLabels: Record<AIProvider, string> = {
  gemini: "Gemini",
  openai: "OpenAI",
  qwen: "Qwen",
  bedrock: "Amazon Bedrock",
  custom: "Custom model",
  local: "Local connector",
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
  initialInput,
}: {
  workflowId: WorkflowId;
  mode: AppMode;
  onSubmit: (input: WorkflowInput) => Promise<void>;
  initialInput?: WorkflowInput;
}) {
  if (workflowId === "bug-triage") {
    return <BugTriageForm mode={mode} onSubmitResult={onSubmit} initialValues={initialInput as BugTriageInput | undefined} />;
  }
  if (workflowId === "meeting-actions") {
    return <MeetingActionsForm mode={mode} onSubmitResult={onSubmit} initialValues={initialInput as MeetingActionsInput | undefined} />;
  }
  return <StatusUpdateForm mode={mode} onSubmitResult={onSubmit} initialValues={initialInput as StatusUpdateInput | undefined} />;
}

function parseHandoffInput(workflowId: WorkflowId, value: unknown): WorkflowInput | undefined {
  const schema = workflowId === "bug-triage"
    ? bugTriageInputSchema
    : workflowId === "meeting-actions"
      ? meetingActionsInputSchema
      : statusUpdateInputSchema;
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}

function ExecutionProgress({ provider, startedAt, phase }: { provider: AIProvider; startedAt: number; phase: string }) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const local = provider === "local";
  const activeStep = phase === "queued" || phase === "preparing" ? 1 : phase === "generating" ? 1 : 2;
  const steps = [
    "Input secured",
    local && phase === "queued" ? "Connector queued" : "Provider generating",
    "Validate & save",
  ];
  return (
    <div className="m-4 overflow-hidden rounded-2xl border border-primary/20 bg-surface-accent sm:m-5" role="status" aria-live="polite">
      <div className="flex items-start gap-4 p-5 sm:p-6">
        <span className="relative grid size-11 shrink-0 place-items-center rounded-xl bg-primary/12 text-primary">
          <span className="absolute inset-0 animate-ping rounded-xl border border-primary/25 opacity-40 motion-reduce:animate-none" />
          <LoaderCircle aria-hidden="true" className="size-5 animate-spin motion-reduce:animate-none" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold text-foreground">{local && phase === "queued" ? "Waiting for your local connector" : `${providerLabels[provider]} is processing the workflow`}</h3>
            <span className="font-mono text-xs font-bold text-primary">{elapsedSeconds}s</span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">{local ? "Keep the paired connector running. The result will be schema-validated before it appears here." : "The request is active. OpsPilot will validate and save the provider result before displaying it."}</p>
          <ol className="mt-5 grid gap-2 sm:grid-cols-3">
            {steps.map((label, index) => (
              <li
                key={label}
                aria-current={index === activeStep ? "step" : undefined}
                className={`flex min-h-10 items-center gap-2 rounded-xl border px-3 text-xs font-semibold transition-colors ${
                  index < activeStep
                    ? "border-success/20 bg-success/8 text-foreground"
                    : index === activeStep
                      ? "border-primary/30 bg-surface-raised text-foreground shadow-[var(--shadow-xs)]"
                      : "border-border bg-surface-soft text-foreground-muted"
                }`}
              >
                <span className="font-mono text-[0.65rem] text-primary">0{index + 1}</span>{label}
              </li>
            ))}
          </ol>
          {elapsedSeconds >= 20 ? <p className="mt-4 text-xs leading-5 text-foreground-soft">Still working—larger models and cold services can take longer. This timer measures real elapsed time; it is not a completion estimate.</p> : null}
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ error, onRetry }: { error: ApiError; onRetry: (() => void) | null }) {
  const authenticationError = error.status === 401;

  return (
    <div className="m-4 rounded-2xl border border-danger/25 bg-danger/8 p-5 sm:m-5 sm:p-6" role="alert">
      <span className="grid size-11 place-items-center rounded-xl bg-danger/12 text-danger">
        <AlertTriangle aria-hidden="true" className="size-5" />
      </span>
      <h3 className="mt-5 text-base font-bold text-foreground">
        {authenticationError ? "Live session needs to be refreshed" : "Live run could not finish"}
      </h3>
      <p className="mt-2 text-sm leading-6 text-foreground-muted">
        {authenticationError
          ? "The live API could not authorize this WorkOS session. Refresh sign-in in another tab, then return here and retry your preserved input."
          : error.message}
      </p>
      {error.requestId ? (
        <details className="mt-4 text-xs text-foreground-soft">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">Technical details</summary>
          <p className="font-mono">Request ID: {error.requestId}</p>
        </details>
      ) : null}
      <div className="mt-5 flex flex-wrap gap-2">
        {authenticationError ? (
          <Button type="button" variant="secondary" asChild>
            <a href="/sign-in" target="_blank" rel="noreferrer">
              <LogIn aria-hidden="true" className="size-4" /> Refresh sign-in
            </a>
          </Button>
        ) : null}
        {(error.retryable || authenticationError) && onRetry ? (
          <Button type="button" variant="secondary" onClick={onRetry}>
            <RefreshCcw aria-hidden="true" className="size-4" />
            {authenticationError ? "Retry authorized run" : "Retry live run"}
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
  handoffId,
}: {
  workflowId: WorkflowId;
  mode: AppMode;
  provider: AIProvider;
  intelligence: IntelligenceLevel;
  handoffId: string | null;
}) {
  const [result, setResult] = useState<DemoResult | null>(null);
  const [runMetadata, setRunMetadata] = useState<RunMetadata | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [lastInput, setLastInput] = useState<WorkflowInput | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [executionPhase, setExecutionPhase] = useState("preparing");
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const handoff = useQuery({
    queryKey: ["handoff", handoffId],
    queryFn: () => browserApi.getHandoff(handoffId as string),
    enabled: Boolean(handoffId),
  });
  const liveMutation = useMutation({
    mutationFn: (input: WorkflowInput) =>
      browserApi.createRun(workflowId, input, { provider, intelligence }, handoffId),
  });

  async function execute(input: WorkflowInput) {
    setLastInput(input);
    setError(null);
    setStartedAt(Date.now());
    setExecutionPhase(provider === "local" ? "preparing" : "generating");
    if (mode === "demo") {
      setRunMetadata(null);
      setResult(runDemoWorkflow(workflowId, input));
      setStartedAt(null);
      return;
    }

    setResult(null);
    try {
      let run = await liveMutation.mutateAsync(input);
      setExecutionPhase(run.execution_phase);
      for (let attempt = 0; run.status === "pending" && attempt < 80; attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1500));
        run = await browserApi.getRun(run.id);
        setExecutionPhase(run.execution_phase);
      }
      if (run.status === "pending") {
        throw new ApiError({ code: "API_TIMEOUT", message: "The workflow is still pending. Check History after confirming that your connector is online.", retryable: true }, 504);
      }
      if (run.status === "failed") {
        throw new ApiError({ code: run.error_code ?? "AI_UNAVAILABLE", message: "The model could not complete this workflow. Review the connection and retry.", retryable: true }, 502);
      }
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
        runId: run.id,
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
    } finally {
      setStartedAt(null);
    }
  }

  const initialInput = handoff.data ? parseHandoffInput(workflowId, handoff.data.draftInput) : undefined;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(24rem,0.88fr)]">
      {handoffId && handoff.isPending ? (
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]" role="status"><LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary motion-reduce:animate-none" /><p className="mt-4 text-sm font-semibold text-foreground">Loading the reviewed workflow draft…</p></div>
      ) : (
        <WorkflowForm workflowId={workflowId} mode={mode} onSubmit={execute} initialInput={initialInput} />
      )}

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

        {startedAt ? (
          <ExecutionProgress provider={provider} startedAt={startedAt} phase={executionPhase} />
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
            <WorkflowResultContent result={result} sourceRunId={runMetadata?.runId ?? null} mode={mode} />
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

export function ManagedWorkflowRunner({ workflowId, handoffId = null }: { workflowId: WorkflowId; handoffId?: string | null }) {
  const { mode, provider, intelligence } = useAppMode();
  return (
    <WorkflowRunnerCore
      key={`${mode}:${provider}:${intelligence}`}
      workflowId={workflowId}
      mode={mode}
      provider={provider}
      intelligence={intelligence}
      handoffId={handoffId}
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
      handoffId={null}
    />
  );
}
