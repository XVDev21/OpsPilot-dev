"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Bot,
  Check,
  GitCompareArrows,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { caseDispositionLabels } from "@/features/cases/presentation";
import { browserApi } from "@/lib/api/browser-client";
import type {
  AIProvider,
  CaseAssessment,
  CaseEvidence,
  IntelligenceLevel,
} from "@/lib/api/types";

function resultString(result: CaseAssessment["result"], key: string) {
  const value = result[key];
  return typeof value === "string" ? value : "";
}

function resultList(result: CaseAssessment["result"], key: string) {
  const value = result[key];
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

const phaseLabels: Record<string, string> = {
  queued: "Waiting for the paired connector",
  preparing: "Preparing evidence-bound context",
  generating: "Analyzing the case with the selected model",
  validating: "Validating the structured assessment",
  saving: "Saving the versioned result",
  completed: "Assessment saved",
  failed: "Assessment did not complete",
};

function AssessmentProgress({
  startedAt,
  phase,
  provider,
}: {
  startedAt: number;
  phase: string;
  provider: string;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  useEffect(() => {
    const update = () =>
      setElapsedSeconds(
        Math.max(0, Math.floor((Date.now() - startedAt) / 1000)),
      );
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const activeStep = phase === "validating" || phase === "saving" ? 2 : 1;
  const steps = ["Evidence secured", "Model analysis", "Validate & save"];
  return (
    <div
      role="status"
      aria-live="polite"
      className="mt-4 overflow-hidden rounded-2xl border border-primary/20 bg-surface-accent p-4"
    >
      <div className="flex items-center gap-3">
        <span className="relative grid size-9 place-items-center rounded-full bg-primary/12">
          <span className="absolute inset-0 animate-ping rounded-full bg-primary/10 motion-reduce:animate-none" />
          <LoaderCircle
            aria-hidden="true"
            className="relative size-4 animate-spin text-primary motion-reduce:animate-none"
          />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold text-foreground">
              {provider} assessment in progress
            </p>
            <span className="font-mono text-xs font-bold text-primary">
              {elapsedSeconds}s
            </span>
          </div>
          <p className="mt-1 text-xs text-foreground-muted">
            {phaseLabels[phase] ?? phaseLabels.preparing}
          </p>
        </div>
      </div>
      <ol className="mt-4 grid gap-2 sm:grid-cols-3">
        {steps.map((label, index) => (
          <li
            key={label}
            aria-current={index === activeStep ? "step" : undefined}
            className={`rounded-xl border px-3 py-2 text-[0.6875rem] font-semibold ${
              index < activeStep
                ? "border-success/20 bg-success/8 text-foreground"
                : index === activeStep
                  ? "border-primary/30 bg-surface-raised text-foreground"
                  : "border-border bg-surface-soft text-foreground-muted"
            }`}
          >
            <span className="mr-2 font-mono text-primary">0{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {elapsedSeconds >= 20 ? (
        <p className="mt-3 text-[0.6875rem] leading-5 text-foreground-soft">
          Still working—cold services and deeper models can take longer. This is
          real elapsed time, not a completion estimate.
        </p>
      ) : null}
    </div>
  );
}

export function CaseAssessmentPanel({
  caseId,
  intent,
  evidence,
  assessments,
  onChanged,
}: {
  caseId: string;
  intent: "issue" | "clarification" | "enhancement";
  evidence: CaseEvidence[];
  assessments: CaseAssessment[];
  onChanged: () => Promise<void>;
}) {
  const options = useQuery({
    queryKey: ["execution-options"],
    queryFn: browserApi.executionOptions,
  });
  const [provider, setProvider] = useState<AIProvider | "">("");
  const [intelligence, setIntelligence] = useState<IntelligenceLevel | "">("");
  const [pendingRunId, setPendingRunId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const effectiveProvider =
    provider || options.data?.defaultProvider || "gemini";
  const effectiveIntelligence =
    intelligence || options.data?.defaultIntelligence || "fast";
  const selectedProvider = options.data?.providers.find(
    (item) => item.id === effectiveProvider,
  );
  const selectedLevel = options.data?.intelligenceLevels.find(
    (item) => item.id === effectiveIntelligence,
  );
  const selectedModel = selectedProvider?.models[effectiveIntelligence] ?? null;
  const latest = assessments[0];
  const modelChanged = Boolean(
    latest &&
      selectedModel &&
      (latest.provider !== effectiveProvider || latest.model !== selectedModel),
  );
  const hasImages = evidence.some((item) => item.kind === "image");
  const imageEvidence = evidence.filter((item) => item.kind === "image");
  const imageBytes = imageEvidence.reduce(
    (total, item) => total + (item.byteSize ?? 0),
    0,
  );
  const imageBudgetExceeded =
    imageEvidence.length > 8 || imageBytes > 24 * 1024 * 1024;
  const capabilityMismatch =
    hasImages && selectedProvider && !selectedProvider.supportsImages;
  const pendingRun = useQuery({
    queryKey: ["case-assessment-run", pendingRunId],
    queryFn: () => browserApi.getRun(pendingRunId ?? ""),
    enabled: Boolean(pendingRunId),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 1400 : false,
  });
  useEffect(() => {
    if (
      !pendingRunId ||
      !pendingRun.data ||
      pendingRun.data.status === "pending"
    )
      return;
    void onChanged().then(() => {
      setPendingRunId(null);
      setStartedAt(null);
    });
  }, [onChanged, pendingRun.data, pendingRunId]);
  const run = useMutation({
    mutationFn: () =>
      browserApi.createCaseAssessment(caseId, {
        provider: effectiveProvider,
        intelligence: effectiveIntelligence,
      }),
    onMutate: () => setStartedAt(Date.now()),
    onSuccess: async (created) => {
      if (created.status === "pending") setPendingRunId(created.id);
      else {
        await onChanged();
        setStartedAt(null);
      }
    },
    onError: () => setStartedAt(null),
  });
  const apply = useMutation({
    mutationFn: (assessmentId: string) =>
      browserApi.applyCaseAssessment(caseId, assessmentId),
    onSuccess: onChanged,
  });

  if (intent === "enhancement") {
    return (
      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-accent text-primary">
            <Sparkles aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
              Additional development
            </p>
            <h2 className="mt-1 text-xl font-bold text-foreground">
              Ready for human scoping
            </h2>
            <p className="mt-2 text-sm leading-6 text-foreground-muted">
              Bug-versus-settings assessment does not apply to this intent. You
              can publish and assign the case directly; requirements and
              delivery updates continue in the case.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
      aria-labelledby="case-assessment-heading"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            Advisory assessment
          </p>
          <h2
            id="case-assessment-heading"
            className="mt-2 text-xl font-bold text-foreground"
          >
            Test the case against the evidence
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-foreground-muted">
            Each run is preserved as a separate assessment. Applying one updates
            the working classification, but never publishes, assigns, resolves,
            or closes the case.
          </p>
        </div>
        <Badge tone={assessments.length ? "success" : "neutral"}>
          {assessments.length} version{assessments.length === 1 ? "" : "s"}
        </Badge>
      </div>

      <div className="mt-5 grid gap-3 rounded-2xl border border-border bg-surface-soft p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
        <div>
          <label
            htmlFor="assessment-provider"
            className="text-xs font-bold text-foreground"
          >
            Configured model provider
          </label>
          <Select
            id="assessment-provider"
            className="mt-1.5"
            value={effectiveProvider}
            onChange={(event) => setProvider(event.target.value as AIProvider)}
            disabled={options.isPending || run.isPending}
          >
            {options.data?.providers
              .filter((item) => item.enabled)
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                  {item.supportsImages ? " · images" : " · text only"}
                </option>
              ))}
          </Select>
        </div>
        <div>
          <label
            htmlFor="assessment-intelligence"
            className="text-xs font-bold text-foreground"
          >
            Intelligence
          </label>
          <Select
            id="assessment-intelligence"
            className="mt-1.5"
            value={effectiveIntelligence}
            onChange={(event) =>
              setIntelligence(event.target.value as IntelligenceLevel)
            }
            disabled={options.isPending || run.isPending}
          >
            {options.data?.intelligenceLevels.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label} · {item.relativeUsage} usage
              </option>
            ))}
          </Select>
          <p className="mt-1 truncate font-mono text-[0.625rem] text-foreground-soft">
            {selectedModel ?? "Model unavailable"}
          </p>
        </div>
        <Button
          type="button"
          onClick={() => run.mutate()}
          disabled={
            run.isPending ||
            Boolean(pendingRunId) ||
            !selectedProvider?.enabled ||
            Boolean(capabilityMismatch) ||
            imageBudgetExceeded
          }
        >
          {run.isPending || pendingRunId ? (
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
          ) : (
            <Bot aria-hidden="true" className="size-4" />
          )}{" "}
          Run assessment
        </Button>
      </div>

      {modelChanged ? (
        <div className="mt-3 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/8 p-3">
          <GitCompareArrows
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p className="text-xs leading-5 text-foreground-muted">
            Switching models creates a separate assessment. Reasoning and
            confidence may differ, so compare versions before applying one;
            OpsPilot never averages or overwrites them.
          </p>
        </div>
      ) : null}
      {capabilityMismatch ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/8 p-3"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p className="text-xs leading-5 text-foreground-muted">
            This case includes image evidence, but {selectedProvider?.label} is
            verified for text only in this release. Choose Gemini to analyze the
            images.
          </p>
        </div>
      ) : null}
      {imageBudgetExceeded ? (
        <div
          role="alert"
          className="mt-3 flex items-start gap-3 rounded-xl border border-warning/25 bg-warning/8 p-3"
        >
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 size-4 shrink-0 text-warning"
          />
          <p className="text-xs leading-5 text-foreground-muted">
            One assessment can analyze up to 8 images totaling 24 MB. Remove
            extra images before this run; completed assessment snapshots remain
            preserved in the case timeline.
          </p>
        </div>
      ) : null}
      {selectedLevel ? (
        <p className="mt-3 text-[0.6875rem] text-foreground-soft">
          {selectedLevel.description}
        </p>
      ) : null}

      {(run.isPending || pendingRunId) && startedAt ? (
        <AssessmentProgress
          startedAt={startedAt}
          phase={pendingRun.data?.execution_phase ?? "generating"}
          provider={selectedProvider?.label ?? effectiveProvider}
        />
      ) : null}
      {run.isError || pendingRun.data?.status === "failed" ? (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-danger/25 bg-danger/8 p-3 text-xs text-danger"
        >
          The assessment did not complete. The case and earlier versions were
          not changed.
        </p>
      ) : null}

      {assessments.length > 1 ? (
        <div className="mt-5 grid gap-2 rounded-2xl border border-border bg-surface-soft p-4 sm:grid-cols-3">
          <div>
            <p className="text-[0.6875rem] font-bold text-foreground-soft">
              Latest model
            </p>
            <p className="mt-1 truncate text-xs font-bold text-foreground">
              {assessments[0].model}
            </p>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold text-foreground-soft">
              Previous model
            </p>
            <p className="mt-1 truncate text-xs font-bold text-foreground">
              {assessments[1].model}
            </p>
          </div>
          <div>
            <p className="text-[0.6875rem] font-bold text-foreground-soft">
              Decision confidence
            </p>
            <p className="mt-1 text-xs font-bold text-foreground">
              {Math.round(assessments[0].decisionConfidence * 100)}% vs{" "}
              {Math.round(assessments[1].decisionConfidence * 100)}%
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-3">
        {assessments.map((assessment, index) => {
          const facts = resultList(assessment.result, "confirmedFacts");
          const gaps = resultList(assessment.result, "evidenceGaps");
          const verification = resultList(
            assessment.result,
            "verificationSteps",
          );
          return (
            <details
              key={assessment.id}
              open={index === 0}
              className="rounded-2xl border border-border bg-surface-soft p-4"
            >
              <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-primary">
                      Assessment {assessment.sequence}
                    </span>
                    <Badge
                      tone={
                        assessment.confidenceBand === "high"
                          ? "success"
                          : assessment.confidenceBand === "medium"
                            ? "warning"
                            : "neutral"
                      }
                    >
                      {assessment.confidenceBand} ·{" "}
                      {Math.round(assessment.decisionConfidence * 100)}%
                    </Badge>
                    <Badge>
                      {caseDispositionLabels[assessment.proposedDisposition]}
                    </Badge>
                    {assessment.isApplied ? (
                      <Badge tone="primary">
                        <Check aria-hidden="true" className="size-3" /> Applied
                      </Badge>
                    ) : null}
                  </div>
                  <span className="font-mono text-[0.625rem] text-foreground-soft">
                    {assessment.provider} / {assessment.model}
                  </span>
                </div>
              </summary>
              <div className="mt-4 border-t border-border pt-4">
                <p className="text-sm font-semibold leading-6 text-foreground">
                  {resultString(assessment.result, "summary") ||
                    "No summary was returned."}
                </p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div>
                    <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-success uppercase">
                      Confirmed facts
                    </p>
                    <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-foreground-muted">
                      {facts.length ? (
                        facts.map((fact) => <li key={fact}>• {fact}</li>)
                      ) : (
                        <li>• No confirmed facts were established.</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-warning uppercase">
                      Evidence gaps
                    </p>
                    <ul className="mt-2 grid gap-1.5 text-xs leading-5 text-foreground-muted">
                      {gaps.length ? (
                        gaps.map((gap) => <li key={gap}>• {gap}</li>)
                      ) : (
                        <li>• No material gaps were reported.</li>
                      )}
                    </ul>
                  </div>
                </div>
                {resultString(assessment.result, "recommendedResolution") ? (
                  <div className="mt-4 rounded-xl border border-success/20 bg-success/8 p-3">
                    <p className="text-[0.6875rem] font-bold text-success uppercase">
                      Recommended resolution
                    </p>
                    <p className="mt-2 text-xs leading-5 text-foreground-muted">
                      {resultString(assessment.result, "recommendedResolution")}
                    </p>
                    {verification.length ? (
                      <ol className="mt-2 grid gap-1 text-xs leading-5 text-foreground-muted">
                        {verification.map((step, stepIndex) => (
                          <li key={step}>
                            {stepIndex + 1}. {step}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                ) : null}
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {assessment.confidenceFactors.map((factor) => (
                    <div
                      key={factor.name}
                      className="rounded-xl bg-surface-raised p-3"
                    >
                      <p className="text-[0.6875rem] font-bold text-foreground">
                        {factor.name} · {Math.round(factor.score * 100)}%
                      </p>
                      <p className="mt-1 text-[0.625rem] leading-4 text-foreground-soft">
                        {factor.rationale}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    variant={assessment.isApplied ? "secondary" : "primary"}
                    disabled={apply.isPending || assessment.isApplied}
                    onClick={() => apply.mutate(assessment.id)}
                  >
                    <ShieldCheck aria-hidden="true" className="size-4" />{" "}
                    {assessment.isApplied
                      ? "Applied to case"
                      : "Apply reviewed assessment"}
                  </Button>
                  <span className="text-[0.6875rem] text-foreground-soft">
                    Human review remains required.
                  </span>
                </div>
              </div>
            </details>
          );
        })}
        {!assessments.length ? (
          <div className="rounded-2xl border border-dashed border-border-strong p-5 text-center">
            <Bot aria-hidden="true" className="mx-auto size-5 text-primary" />
            <p className="mt-3 text-sm font-bold text-foreground">
              No assessment versions yet
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Publishing and assignment are still available without an AI
              result.
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
