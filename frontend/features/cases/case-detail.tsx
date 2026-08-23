"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  ArrowLeft,
  Bot,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Clock3,
  LoaderCircle,
  Route,
  UserRoundCog,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  allowedCaseTransitions,
  caseDispositionLabels,
  caseDispositions,
  caseStatusLabels,
  eventLabel,
  formatCaseDate,
} from "@/features/cases/presentation";
import { browserApi } from "@/lib/api/browser-client";
import type {
  CaseDisposition,
  CaseStatus,
  OperationsCaseDetail,
  WorkItemStatus,
} from "@/lib/api/types";

const workItemStatuses: [WorkItemStatus, string][] = [
  ["todo", "To do"],
  ["in-progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
];

function eventDescription(event: OperationsCaseDetail["events"][number]) {
  const payload = event.payload;
  if (event.type === "assignment-changed") {
    return `Ownership moved to ${String(payload.toMemberName ?? "Unassigned")}.`;
  }
  if (event.type === "status-changed") {
    return `State changed from ${String(payload.from)} to ${String(payload.to)}.`;
  }
  if (event.type === "disposition-changed") {
    return `Disposition changed from ${String(payload.from)} to ${String(payload.to)}.`;
  }
  if (event.type === "workflow-linked") {
    return `${String(payload.workflowId ?? "Workflow")} run linked to this case.`;
  }
  if (event.type === "work-item-created") {
    return `${String(payload.title ?? "Work item")} entered the delivery board.`;
  }
  if (event.type === "work-item-updated") {
    return `${String(payload.title ?? "Work item")} was updated.`;
  }
  if (event.type === "resolution-recorded") return "The resolution record was updated.";
  if (event.type === "created") return "The operations case was opened.";
  return "Case evidence or delivery state changed.";
}

export function CaseDetail({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({ queryKey: ["case", caseId], queryFn: () => browserApi.getCase(caseId) });
  const members = useQuery({ queryKey: ["workspace-members"], queryFn: browserApi.listWorkspaceMembers });
  const [dueDate, setDueDate] = useState("");
  const [resolution, setResolution] = useState("");
  useEffect(() => {
    if (!detail.data) return;
    setDueDate(detail.data.dueDate ?? "");
    setResolution(detail.data.resolutionSummary);
  }, [detail.data]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
      queryClient.invalidateQueries({ queryKey: ["cases"] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
    ]);
  };
  const updateCase = useMutation({ mutationFn: (input: Parameters<typeof browserApi.updateCase>[1]) => browserApi.updateCase(caseId, input), onSuccess: refresh });
  const assign = useMutation({ mutationFn: (memberId: string | null) => browserApi.assignCase(caseId, memberId), onSuccess: refresh });
  const updateWork = useMutation({ mutationFn: ({ itemId, input }: { itemId: string; input: Parameters<typeof browserApi.updateWorkItem>[1] }) => browserApi.updateWorkItem(itemId, input), onSuccess: refresh });

  if (detail.isPending) {
    return <p role="status" className="flex items-center gap-2 text-sm text-foreground-muted"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" /> Loading operations case…</p>;
  }
  if (detail.isError || !detail.data) {
    return <div className="rounded-[var(--radius-panel)] border border-danger/25 bg-danger/8 p-6"><h1 className="text-xl font-bold text-foreground">Case unavailable</h1><p className="mt-2 text-sm text-foreground-muted">This case could not be loaded or is outside your workspace.</p><Button asChild variant="secondary" className="mt-5"><Link href="/app/cases"><ArrowLeft aria-hidden="true" className="size-4" /> Back to cases</Link></Button></div>;
  }

  const item = detail.data;
  const transitionOptions = [item.status, ...allowedCaseTransitions[item.status]];
  const mutationError = updateCase.error || assign.error || updateWork.error;

  return (
    <div className="grid gap-6">
      <nav aria-label="Breadcrumb"><Link href="/app/cases" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-foreground"><ArrowLeft aria-hidden="true" className="size-4" /> Case register</Link></nav>

      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-panel)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-sm font-extrabold text-primary">{item.key}</span><Badge tone={item.status === "resolved" || item.status === "closed" ? "success" : "primary"}>{caseStatusLabels[item.status]}</Badge><Badge>{caseDispositionLabels[item.disposition]}</Badge></div>
            <h1 className="mt-4 max-w-4xl text-balance text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">{item.title}</h1>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-foreground-muted">{item.description}</p>
            {item.summary ? <div className="mt-6 rounded-2xl border border-primary/15 bg-surface-accent p-4"><p className="text-xs font-bold tracking-[0.08em] text-primary uppercase">Working summary</p><p className="mt-2 text-sm leading-6 text-foreground">{item.summary}</p></div> : null}
            <div className="mt-6 flex flex-wrap gap-2"><Button asChild><Link href={`/app/workflows/bug-triage?case=${item.id}`}><Bot aria-hidden="true" className="size-4" /> Run Bug Triage</Link></Button><Button asChild variant="secondary"><Link href={`/app/work-items?case=${item.id}`}><BriefcaseBusiness aria-hidden="true" className="size-4" /> Open case work</Link></Button></div>
          </div>

          <aside className="border-t border-border bg-surface-soft p-5 lg:border-t-0 lg:border-l sm:p-6" aria-label="Case controls">
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Control plane</p>
            <div className="mt-5 grid gap-4">
              <div><label htmlFor="case-state" className="text-xs font-bold text-foreground">State</label><Select id="case-state" className="mt-1.5" value={item.status} disabled={updateCase.isPending} onChange={(event) => updateCase.mutate({ status: event.target.value as CaseStatus })}>{transitionOptions.map((value) => <option key={value} value={value}>{caseStatusLabels[value]}</option>)}</Select></div>
              <div><label htmlFor="case-type" className="text-xs font-bold text-foreground">Disposition</label><Select id="case-type" className="mt-1.5" value={item.disposition} disabled={updateCase.isPending} onChange={(event) => updateCase.mutate({ disposition: event.target.value as CaseDisposition })}>{caseDispositions.map((value) => <option key={value} value={value}>{caseDispositionLabels[value]}</option>)}</Select></div>
              <div><label htmlFor="case-owner" className="text-xs font-bold text-foreground">Case owner</label><Select id="case-owner" className="mt-1.5" value={item.assignee?.id ?? ""} disabled={assign.isPending} onChange={(event) => assign.mutate(event.target.value || null)}><option value="">Unassigned</option>{members.data?.items.map((member) => <option key={member.id} value={member.id}>{member.name}{member.isSample ? " · sample" : ""}</option>)}</Select></div>
              <div><label htmlFor="case-due-date" className="text-xs font-bold text-foreground">Target date</label><div className="mt-1.5 flex gap-2"><Input id="case-due-date" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /><Button type="button" size="sm" variant="secondary" onClick={() => updateCase.mutate({ dueDate: dueDate || null })} disabled={updateCase.isPending || dueDate === (item.dueDate ?? "")}>Save</Button></div></div>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2 border-t border-border pt-5"><div className="rounded-xl bg-surface-raised p-3"><p className="font-mono text-lg font-bold text-foreground">{item.workItemCount}</p><p className="mt-1 text-[0.6875rem] text-foreground-muted">Work items</p></div><div className="rounded-xl bg-surface-raised p-3"><p className="font-mono text-lg font-bold text-foreground">{item.confidence === null ? "—" : `${Math.round(item.confidence * 100)}%`}</p><p className="mt-1 text-[0.6875rem] text-foreground-muted">Confidence</p></div></div>
          </aside>
        </div>
      </section>

      {mutationError ? <p role="alert" className="rounded-xl border border-danger/25 bg-danger/8 p-3 text-sm text-danger">That change was not saved. The case remains at its previous valid state.</p> : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.75fr)]">
        <div className="grid gap-6">
          <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="case-work-heading">
            <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Delivery</p><h2 id="case-work-heading" className="mt-2 text-xl font-bold text-foreground">Case work</h2></div><Badge tone="primary">{item.completedWorkItemCount}/{item.workItemCount} complete</Badge></div>
            <div className="mt-5 grid gap-3">
              {item.workItems.length ? item.workItems.map((work) => (
                <article key={work.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><Badge tone={work.kind === "engineering" ? "warning" : "neutral"}>{work.kind}</Badge><h3 className="mt-2 text-sm font-bold text-foreground">{work.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">{work.description}</p></div><span className="flex items-center gap-1.5 text-xs text-foreground-soft"><CalendarDays aria-hidden="true" className="size-3.5" /> {formatCaseDate(work.dueDate)}</span></div>
                  <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2"><div><label htmlFor={`work-state-${work.id}`} className="text-[0.6875rem] font-bold text-foreground-soft">State</label><Select id={`work-state-${work.id}`} className="mt-1 min-h-10 text-xs" value={work.status} disabled={updateWork.isPending} onChange={(event) => updateWork.mutate({ itemId: work.id, input: { status: event.target.value as WorkItemStatus } })}>{workItemStatuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select></div><div><label htmlFor={`work-owner-${work.id}`} className="text-[0.6875rem] font-bold text-foreground-soft">Owner</label><Select id={`work-owner-${work.id}`} className="mt-1 min-h-10 text-xs" value={work.assignee?.id ?? ""} disabled={updateWork.isPending} onChange={(event) => updateWork.mutate({ itemId: work.id, input: { assigneeId: event.target.value || null } })}><option value="">Unassigned</option>{members.data?.items.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select></div></div>
                </article>
              )) : <div className="rounded-2xl border border-dashed border-border-strong p-5"><BriefcaseBusiness aria-hidden="true" className="size-5 text-primary" /><p className="mt-3 text-sm font-bold text-foreground">No delivery work yet</p><p className="mt-1 text-xs leading-5 text-foreground-muted">Run Bug Triage, review the result, then create a work item without losing this case context.</p></div>}
            </div>
          </section>

          <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="resolution-heading">
            <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success"><CheckCircle2 aria-hidden="true" className="size-5" /></span><div><h2 id="resolution-heading" className="text-lg font-bold text-foreground">Resolution record</h2><p className="mt-1 text-xs leading-5 text-foreground-muted">Capture what changed, what was verified, and what the user should expect now.</p></div></div>
            <Textarea className="mt-4 min-h-28" value={resolution} onChange={(event) => setResolution(event.target.value)} placeholder="Example: Enabled Holiday fields in Payroll Settings, verified visibility for the client role, and documented the configuration path." maxLength={4000} />
            <Button type="button" variant="secondary" className="mt-3" disabled={updateCase.isPending || resolution === item.resolutionSummary} onClick={() => updateCase.mutate({ resolutionSummary: resolution })}>Save resolution</Button>
          </section>
        </div>

        <aside className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6 xl:sticky xl:top-24" aria-labelledby="case-activity-heading">
          <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Audit trail</p><h2 id="case-activity-heading" className="mt-2 text-xl font-bold text-foreground">Case activity</h2></div><Activity aria-hidden="true" className="size-5 text-primary" /></div>
          <ol className="mt-6 grid gap-0">
            {item.events.map((event, index) => (
              <li key={event.id} className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0">
                {index < item.events.length - 1 ? <span aria-hidden="true" className="absolute top-5 bottom-0 left-[0.43rem] w-px bg-border" /> : null}
                <span className="relative mt-1 size-3 rounded-full border-2 border-surface-raised bg-primary shadow-[0_0_0_1px_var(--border)]" aria-hidden="true" />
                <div><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-xs font-bold text-foreground">{eventLabel(event.type)}</h3><time className="flex items-center gap-1 font-mono text-[0.625rem] text-foreground-soft" dateTime={event.createdAt}><Clock3 aria-hidden="true" className="size-3" /> {new Date(event.createdAt).toLocaleString()}</time></div><p className="mt-1 text-xs leading-5 text-foreground-muted">{eventDescription(event)}</p><p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-foreground-soft"><CircleDot aria-hidden="true" className="size-3" /> {event.actorName}</p></div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/15 bg-surface-accent p-3"><Route aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-xs leading-5 text-foreground-muted">Events are append-only evidence. Sample members can own work, but only your authenticated account generates activity.</p></div>
        </aside>
      </div>
    </div>
  );
}
