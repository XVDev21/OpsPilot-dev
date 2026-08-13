"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CloudOff, FileClock, LoaderCircle, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getWorkflow } from "@/features/workflows/registry";
import { runDate, runPreview, runTitle } from "@/features/history/presentation";
import { browserApi } from "@/lib/api/browser-client";
import type { RunStatus, WorkflowRun } from "@/lib/api/types";
import { cn } from "@/lib/utils";

type HistoryFilter = "all" | "completed" | "failed";
const filters: { value: HistoryFilter; label: string }[] = [
  { value: "all", label: "All runs" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Needs attention" },
];

const statusTone: Record<RunStatus, "primary" | "success" | "warning"> = {
  pending: "primary",
  completed: "success",
  failed: "warning",
};

export function HistoryList() {
  const [filter, setFilter] = useState<HistoryFilter>("all");
  const runs = useQuery({ queryKey: ["runs"], queryFn: browserApi.listRuns });
  const items = runs.data?.items;
  const filtered = useMemo(
    () => items?.filter((run: WorkflowRun) => filter === "all" || run.status === filter) ?? [],
    [filter, items],
  );

  if (runs.isPending) {
    return <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-8 text-center shadow-[var(--shadow-sm)]" role="status"><LoaderCircle aria-hidden="true" className="mx-auto size-6 animate-spin text-primary motion-reduce:animate-none" /><p className="mt-4 text-sm font-semibold text-foreground">Loading your run history</p></div>;
  }

  if (runs.isError) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-warning/25 bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
        <CloudOff aria-hidden="true" className="size-7 text-warning" />
        <h2 className="mt-5 text-xl font-bold text-foreground">History is waiting for the backend</h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-foreground-muted">Your WorkOS session is active, but the Django history service is not reachable yet. No local demo result is being presented as saved history.</p>
        <Button type="button" variant="secondary" className="mt-5" onClick={() => void runs.refetch()}><RefreshCcw aria-hidden="true" className="size-4" /> Try again</Button>
      </div>
    );
  }

  const allRuns = items ?? [];

  return (
    <div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter run history">
        {filters.map((item) => (
          <button key={item.value} type="button" aria-pressed={filter === item.value} onClick={() => setFilter(item.value)} className={cn("min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors", filter === item.value ? "border-primary/35 bg-surface-accent text-primary" : "border-border bg-surface-raised text-foreground-muted hover:border-primary/25 hover:text-foreground")}>{item.label}</button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="paper-grid mt-5 rounded-[var(--radius-panel)] border border-dashed border-border-strong bg-surface-raised p-7 sm:p-10">
          <span className="grid size-12 place-items-center rounded-2xl bg-surface-accent text-primary"><FileClock aria-hidden="true" className="size-5" /></span>
          <h2 className="mt-6 text-xl font-bold text-foreground">{allRuns.length === 0 ? "No live runs yet" : "No runs match this filter"}</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-foreground-muted">{allRuns.length === 0 ? "Complete a workflow in Live Mode and its reviewable result will appear here." : "Choose another status to see the rest of your history."}</p>
          {allRuns.length === 0 ? <Button asChild className="mt-5"><Link href="/app/workflows">Choose a workflow</Link></Button> : null}
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {filtered.map((run: WorkflowRun) => {
            const workflow = getWorkflow(run.workflow_id);
            return (
              <Link key={run.id} href={`/app/history/${run.id}`} className="group grid gap-4 rounded-2xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[var(--shadow-md)] sm:grid-cols-[1fr_auto] sm:items-center sm:p-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Badge>{workflow.shortTitle}</Badge><Badge tone={statusTone[run.status]}>{run.status}</Badge></div>
                  <h2 className="mt-3 truncate text-base font-bold text-foreground">{runTitle(run)}</h2>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground-muted">{runPreview(run)}</p>
                  <p className="mt-3 text-xs text-foreground-soft">{runDate(run.created_at)}</p>
                </div>
                <span className="grid size-10 place-items-center rounded-xl bg-surface-soft text-foreground-muted group-hover:bg-primary group-hover:text-primary-foreground"><ArrowUpRight aria-hidden="true" className="size-4" /></span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
