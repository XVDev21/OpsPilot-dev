"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CircleUserRound,
  LoaderCircle,
  RadioTower,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  caseDispositionLabels,
  caseStatusLabels,
  formatCaseDate,
} from "@/features/cases/presentation";
import { browserApi } from "@/lib/api/browser-client";
import type { OperationsCaseSummary } from "@/lib/api/types";

type Scope = "all" | "mine" | "attention" | "verification" | "resolved";

const scopes: { value: Scope; label: string }[] = [
  { value: "all", label: "Workspace" },
  { value: "mine", label: "My assigned" },
  { value: "attention", label: "Needs attention" },
  { value: "verification", label: "Verification" },
  { value: "resolved", label: "Resolved" },
];

function matchesScope(item: OperationsCaseSummary, scope: Scope, memberId?: string) {
  if (scope === "mine") return item.assignee?.id === memberId;
  if (scope === "attention") {
    return ["needs-information", "action-required"].includes(item.status) || !item.assignee;
  }
  if (scope === "verification") return item.status === "verification";
  if (scope === "resolved") return ["resolved", "closed"].includes(item.status);
  return true;
}

export function WorkStatusBoard() {
  const [scope, setScope] = useState<Scope>("all");
  const cases = useQuery({
    queryKey: ["cases", "work-status"],
    queryFn: () => browserApi.listCases({ publicationState: "published", pageSize: "50" }),
  });
  const members = useQuery({
    queryKey: ["workspace-members"],
    queryFn: browserApi.listWorkspaceMembers,
  });
  const signedInMember = members.data?.items.find((member) => member.linkedAccount);
  const items = useMemo(
    () => (cases.data?.items ?? []).filter((item) => matchesScope(item, scope, signedInMember?.id)),
    [cases.data?.items, scope, signedInMember?.id],
  );
  const attentionCount = (cases.data?.items ?? []).filter((item) => matchesScope(item, "attention")).length;
  const verificationCount = (cases.data?.items ?? []).filter((item) => item.status === "verification").length;

  if (cases.isPending) {
    return (
      <div role="status" className="flex min-h-52 items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-border bg-surface-raised">
        <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary motion-reduce:animate-none" />
        <span className="text-sm font-bold text-foreground">Reading workspace delivery signals…</span>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-panel)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="p-5 sm:p-7">
            <div className="flex items-center gap-2 text-primary">
              <RadioTower aria-hidden="true" className="size-4" />
              <p className="text-xs font-bold tracking-[0.1em] uppercase">Delivery control</p>
            </div>
            <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
              Work Status
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-foreground-muted">
              One workspace view for published cases, current ownership, deadlines, task progress,
              and the next human decision. Open a case to post an attributed update.
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-border bg-surface-soft lg:border-t-0 lg:border-l">
            <div className="p-5 sm:p-6">
              <AlertTriangle aria-hidden="true" className="size-5 text-warning" />
              <p className="mt-4 font-mono text-3xl font-bold text-foreground">{attentionCount}</p>
              <p className="mt-1 text-xs text-foreground-muted">Need attention</p>
            </div>
            <div className="border-l border-border p-5 sm:p-6">
              <CheckCircle2 aria-hidden="true" className="size-5 text-success" />
              <p className="mt-4 font-mono text-3xl font-bold text-foreground">{verificationCount}</p>
              <p className="mt-1 text-xs text-foreground-muted">Await verification</p>
            </div>
          </div>
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Work Status scope">
        {scopes.map((candidate) => (
          <Button
            key={candidate.value}
            type="button"
            variant={scope === candidate.value ? "primary" : "secondary"}
            size="sm"
            role="tab"
            aria-selected={scope === candidate.value}
            onClick={() => setScope(candidate.value)}
            className="shrink-0"
          >
            {candidate.label}
          </Button>
        ))}
      </div>

      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]" aria-label="Published case work status">
        <div className="hidden grid-cols-[minmax(0,1fr)_11rem_12rem_9rem_3rem] gap-4 border-b border-border bg-surface-soft px-5 py-3 text-[0.6875rem] font-bold tracking-[0.06em] text-foreground-soft uppercase lg:grid">
          <span>Case</span><span>State</span><span>Owner</span><span>Target</span><span />
        </div>
        <div className="divide-y divide-border">
          {items.map((item) => (
            <article key={item.id} className="group grid gap-4 px-5 py-5 transition-colors hover:bg-surface-soft lg:grid-cols-[minmax(0,1fr)_11rem_12rem_9rem_3rem] lg:items-center">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-primary">{item.key}</span>
                  <Badge>{caseDispositionLabels[item.disposition]}</Badge>
                </div>
                <Link href={`/app/cases/${item.id}`} className="mt-2 block truncate text-sm font-bold text-foreground hover:text-primary">
                  {item.title}
                </Link>
                <div className="mt-2 flex items-center gap-3 text-[0.6875rem] text-foreground-soft">
                  <span>{item.completedWorkItemCount}/{item.workItemCount} tasks complete</span>
                  <span aria-hidden="true">·</span>
                  <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
                </div>
              </div>
              <div><Badge tone={item.status === "verification" ? "warning" : item.status === "resolved" ? "success" : "primary"}>{caseStatusLabels[item.status]}</Badge></div>
              <div className="flex items-center gap-2 text-xs text-foreground-muted">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-surface-accent font-mono text-[0.625rem] font-bold text-primary">
                  {item.assignee?.initials ?? <CircleUserRound aria-hidden="true" className="size-4" />}
                </span>
                <span className="truncate">{item.assignee?.name ?? "Unassigned"}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-foreground-muted"><CalendarDays aria-hidden="true" className="size-4" /> {formatCaseDate(item.dueDate)}</div>
              <Button asChild variant="ghost" size="icon" aria-label={`Open ${item.key}`}>
                <Link href={`/app/cases/${item.id}`}><ArrowRight aria-hidden="true" className="size-4" /></Link>
              </Button>
            </article>
          ))}
          {!items.length ? (
            <div className="grid min-h-52 place-items-center p-8 text-center">
              <div>
                <CheckCircle2 aria-hidden="true" className="mx-auto size-7 text-success" />
                <p className="mt-3 text-sm font-bold text-foreground">No cases in this view</p>
                <p className="mt-1 text-xs text-foreground-muted">Choose another scope or publish a prepared case.</p>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
