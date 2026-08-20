"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CloudOff, FileQuestion, LoaderCircle, RefreshCcw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyResultButton } from "@/features/workflows/copy-result-button";
import { getWorkflow } from "@/features/workflows/registry";
import { runToResult } from "@/features/workflows/run-adapter";
import { resultToText, WorkflowResultContent } from "@/features/workflows/workflow-result";
import { runDate, runTitle } from "@/features/history/presentation";
import { browserApi } from "@/lib/api/browser-client";

export function HistoryDetail({ runId }: { runId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const runQuery = useQuery({ queryKey: ["runs", runId], queryFn: () => browserApi.getRun(runId) });
  const deleteRun = useMutation({
    mutationFn: () => browserApi.deleteRun(runId),
    async onSuccess() {
      await queryClient.invalidateQueries({ queryKey: ["runs"] });
      router.push("/app/history");
    },
  });

  if (runQuery.isPending) {
    return <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-8 text-center shadow-[var(--shadow-sm)]" role="status"><LoaderCircle aria-hidden="true" className="mx-auto size-6 animate-spin text-primary motion-reduce:animate-none" /><p className="mt-4 text-sm font-semibold text-foreground">Loading run details</p></div>;
  }

  if (runQuery.isError) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-warning/25 bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <CloudOff aria-hidden="true" className="size-7 text-warning" />
        <h1 className="mt-5 text-2xl font-bold text-foreground">This run is unavailable</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-muted">The Django API could not return this saved run. It may be unavailable, deleted, or outside this account.</p>
        <div className="mt-5 flex flex-wrap gap-2"><Button type="button" variant="secondary" onClick={() => void runQuery.refetch()}><RefreshCcw aria-hidden="true" className="size-4" /> Try again</Button><Button asChild variant="ghost"><Link href="/app/history">Back to history</Link></Button></div>
      </div>
    );
  }

  const run = runQuery.data;
  if (!run) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-warning/25 bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8" role="alert">
        <FileQuestion aria-hidden="true" className="size-7 text-warning" />
        <h1 className="mt-5 text-2xl font-bold text-foreground">This run returned no data</h1>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">Return to history and try opening the run again.</p>
        <Button asChild variant="secondary" className="mt-5"><Link href="/app/history">Back to history</Link></Button>
      </div>
    );
  }
  const workflow = getWorkflow(run.workflow_id);
  let result = null;
  try {
    result = runToResult(run);
  } catch {
    result = null;
  }

  return (
    <div>
      <Link href="/app/history" className="inline-flex min-h-11 items-center gap-2 rounded-xl text-sm font-semibold text-foreground-muted hover:text-foreground"><ArrowLeft aria-hidden="true" className="size-4" /> Back to history</Link>
      <div className="mt-4 flex flex-col gap-5 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><Badge>{workflow.shortTitle}</Badge><Badge tone={run.status === "completed" ? "success" : run.status === "failed" ? "warning" : "primary"}>{run.status}</Badge></div>
          <h1 className="mt-4 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">{runTitle(run)}</h1>
          <p className="mt-2 text-sm text-foreground-muted">Created {runDate(run.created_at)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {result ? <CopyResultButton text={resultToText(result)} /> : null}
          <ConfirmDialog
            title="Delete this run?"
            description="This removes the saved input and result from your OpsPilot history. The action cannot be undone."
            confirmLabel="Delete run"
            pending={deleteRun.isPending}
            onConfirm={() => deleteRun.mutate()}
            trigger={<Button type="button" variant="danger"><Trash2 aria-hidden="true" className="size-4" /> Delete</Button>}
          />
        </div>
      </div>

      {deleteRun.isError ? <p className="mt-4 rounded-xl border border-danger/25 bg-danger/8 p-4 text-sm text-danger" role="alert">The run could not be deleted. Please retry when the backend is available.</p> : null}

      <div className="mt-7 grid items-start gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="input-heading">
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Input</p>
          <h2 id="input-heading" className="mt-2 text-lg font-bold text-foreground">Submitted context</h2>
          <pre className="mt-5 max-h-[32rem] overflow-auto whitespace-pre-wrap break-words rounded-xl bg-surface-soft p-4 font-mono text-xs leading-6 text-foreground-muted">{JSON.stringify(run.input_json, null, 2)}</pre>
        </section>

        <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]" aria-labelledby="result-heading">
          <div className="border-b border-border p-5 sm:p-6"><p className="text-xs font-bold tracking-[0.1em] text-accent uppercase">Result</p><h2 id="result-heading" className="mt-2 text-lg font-bold text-foreground">Structured artifact</h2></div>
          {result ? <div className="p-5 sm:p-6"><WorkflowResultContent result={result} /></div> : <div className="p-6 sm:p-8"><span className="grid size-11 place-items-center rounded-xl bg-surface-soft text-foreground-muted"><FileQuestion aria-hidden="true" className="size-5" /></span><h3 className="mt-5 text-base font-bold text-foreground">No valid result is available</h3><p className="mt-2 text-sm leading-6 text-foreground-muted">This run is pending, failed, or returned output that did not satisfy the workflow schema.</p></div>}
        </section>
      </div>

      <details className="mt-5 rounded-2xl border border-border bg-surface-raised px-5 py-3 shadow-[var(--shadow-sm)]">
        <summary className="min-h-11 cursor-pointer content-center text-sm font-bold text-foreground">Technical details</summary>
        <dl className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
          <div className="bg-surface-soft p-4"><dt className="text-xs text-foreground-soft">Provider / model</dt><dd className="mt-1 text-sm font-semibold text-foreground">{run.provider ?? "Not recorded"} / {run.model ?? "Not recorded"}</dd></div>
          <div className="bg-surface-soft p-4"><dt className="text-xs text-foreground-soft">Credential</dt><dd className="mt-1 text-sm font-semibold text-foreground">{run.credential_source === "personal" ? "Personal key" : run.credential_source === "platform" ? "Workspace key" : "Not recorded"}</dd></div>
          <div className="bg-surface-soft p-4"><dt className="text-xs text-foreground-soft">Duration</dt><dd className="mt-1 text-sm font-semibold text-foreground">{run.duration_ms === null ? "Not recorded" : `${run.duration_ms} ms`}</dd></div>
          <div className="bg-surface-soft p-4"><dt className="text-xs text-foreground-soft">Run ID</dt><dd className="mt-1 break-all font-mono text-xs text-foreground">{run.id}</dd></div>
        </dl>
      </details>
    </div>
  );
}
