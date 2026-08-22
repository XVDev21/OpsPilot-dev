"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, CircleDot, LoaderCircle, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { sampleTeamMembers } from "@/lib/collaboration/sample-team";
import { browserApi } from "@/lib/api/browser-client";
import type { WorkflowHandoff, WorkItemStatus } from "@/lib/api/types";

const statusColumns = [
  ["todo", "To do"],
  ["in-progress", "In progress"],
  ["blocked", "Blocked"],
  ["done", "Done"],
] as const;

type Draft = {
  title: string;
  description: string;
  kind: "engineering" | "verification" | "investigation" | "follow-up";
  assigneeId: string;
  dueDate: string;
};

function draftFromHandoff(handoff: WorkflowHandoff): Draft {
  const input = handoff.draftInput;
  return {
    title: typeof input.title === "string" ? input.title : "",
    description: typeof input.description === "string" ? input.description : "",
    kind: input.kind === "engineering" || input.kind === "verification" || input.kind === "follow-up"
      ? input.kind
      : "investigation",
    assigneeId: typeof input.assigneeId === "string" ? input.assigneeId : "",
    dueDate: typeof input.dueDate === "string" ? input.dueDate : "",
  };
}

function ReviewWorkItemDraft({ handoff }: { handoff: WorkflowHandoff }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFromHandoff(handoff));
  const create = useMutation({
    mutationFn: () => browserApi.createWorkItem({ handoffId: handoff.id, ...draft, dueDate: draft.dueDate || null }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["work-items"] });
      router.replace("/app/work-items");
    },
  });

  return (
    <form className="mt-6 grid gap-5" onSubmit={(event) => { event.preventDefault(); create.mutate(); }}>
      <div><label htmlFor="work-item-title" className="text-xs font-bold text-foreground">Title</label><Input id="work-item-title" className="mt-1.5" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} required minLength={3} maxLength={200} /></div>
      <div><label htmlFor="work-item-description" className="text-xs font-bold text-foreground">Scope and evidence</label><Textarea id="work-item-description" className="mt-1.5 min-h-48" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} required minLength={12} maxLength={6000} /></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div><label htmlFor="work-item-kind" className="text-xs font-bold text-foreground">Work type</label><Select id="work-item-kind" className="mt-1.5" value={draft.kind} onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as Draft["kind"] }))}><option value="engineering">Engineering defect</option><option value="verification">Configuration verification</option><option value="investigation">Evidence investigation</option><option value="follow-up">Meeting follow-up</option></Select></div>
        <div><label htmlFor="work-item-assignee" className="text-xs font-bold text-foreground">Sample owner</label><Select id="work-item-assignee" className="mt-1.5" value={draft.assigneeId} onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}><option value="">Unassigned</option>{sampleTeamMembers.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.role}</option>)}</Select></div>
        <div><label htmlFor="work-item-due" className="text-xs font-bold text-foreground">Due date</label><Input id="work-item-due" type="date" className="mt-1.5" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></div>
      </div>
      {create.isError ? <p className="text-xs text-danger" role="alert">The work item could not be created. The draft remains available.</p> : null}
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={create.isPending}>{create.isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <BriefcaseBusiness aria-hidden="true" className="size-4" />} Create reviewed work item</Button><Button type="button" variant="ghost" onClick={() => router.replace("/app/work-items")}>Keep as draft</Button></div>
    </form>
  );
}

export function WorkItemsPanel({ handoffId }: { handoffId: string | null }) {
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["work-items"], queryFn: browserApi.listWorkItems });
  const handoff = useQuery({ queryKey: ["handoff", handoffId], queryFn: () => browserApi.getHandoff(handoffId as string), enabled: Boolean(handoffId) });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: WorkItemStatus }) => browserApi.updateWorkItemStatus(id, status),
    onSuccess: async () => queryClient.invalidateQueries({ queryKey: ["work-items"] }),
  });

  return (
    <div className="grid gap-5">
      {handoffId ? (
        <section className="rounded-[var(--radius-panel)] border border-primary/25 bg-surface-raised p-5 shadow-[var(--shadow-panel)] sm:p-6" aria-labelledby="work-item-review-heading">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-accent text-primary"><ShieldAlert aria-hidden="true" className="size-5" /></span>
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Human review</p>
              <h2 id="work-item-review-heading" className="mt-1 text-xl font-bold text-foreground">Review before creating work</h2>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">The triage result supplied this draft. Edit ownership and scope before it becomes a persistent work item.</p>
            </div>
          </div>
          {handoff.isPending ? <p className="mt-5 flex items-center gap-2 text-sm text-foreground-muted" role="status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" /> Loading draft…</p> : handoff.isError || !handoff.data ? <p className="mt-5 text-sm text-danger" role="alert">This draft could not be loaded.</p> : handoff.data.target !== "work-item" ? <p className="mt-5 text-sm text-danger" role="alert">This handoff is not a work-item draft.</p> : <ReviewWorkItemDraft key={handoff.data.id} handoff={handoff.data} />}
        </section>
      ) : null}

      <section aria-labelledby="work-board-heading">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Delivery board</p><h2 id="work-board-heading" className="mt-2 text-xl font-bold text-foreground">Personal work items</h2></div><Badge tone="primary">{list.data?.items.length ?? 0} items</Badge></div>
        {list.isPending ? <p className="mt-5 flex items-center gap-2 text-sm text-foreground-muted" role="status"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" /> Loading work items…</p> : list.isError ? <p className="mt-5 text-sm text-danger" role="alert">Work items could not be loaded.</p> : (
          <div className="mt-5 grid gap-4 xl:grid-cols-4">
            {statusColumns.map(([status, label]) => {
              const items = list.data?.items.filter((item) => item.status === status) ?? [];
              return <section key={status} className="min-w-0 rounded-2xl border border-border bg-surface-soft p-3" aria-label={label}>
                <div className="flex items-center justify-between gap-2 px-1 py-2"><h3 className="flex items-center gap-2 text-sm font-bold text-foreground">{status === "done" ? <CheckCircle2 aria-hidden="true" className="size-4 text-success" /> : <CircleDot aria-hidden="true" className="size-4 text-primary" />}{label}</h3><span className="font-mono text-xs text-foreground-soft">{items.length}</span></div>
                <div className="mt-2 grid gap-2">{items.length ? items.map((item) => <article key={item.id} className="rounded-xl border border-border bg-surface-raised p-3 shadow-[var(--shadow-sm)]"><Badge tone={item.kind === "engineering" ? "warning" : "neutral"}>{item.kind}</Badge><h4 className="mt-3 text-sm font-bold leading-5 text-foreground">{item.title}</h4><p className="mt-2 line-clamp-3 text-xs leading-5 text-foreground-muted">{item.description}</p><label className="mt-3 block text-[0.6875rem] font-bold text-foreground-soft" htmlFor={`status-${item.id}`}>State</label><Select id={`status-${item.id}`} className="mt-1 min-h-10 text-xs" value={item.status} disabled={update.isPending} onChange={(event) => update.mutate({ id: item.id, status: event.target.value as WorkItemStatus })}>{statusColumns.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</Select></article>) : <p className="rounded-xl border border-dashed border-border-strong p-3 text-xs leading-5 text-foreground-soft">No items in this state.</p>}</div>
              </section>;
            })}
          </div>
        )}
        <p className="mt-4 flex items-center gap-2 text-xs text-foreground-soft"><ArrowRight aria-hidden="true" className="size-3.5" /> Work items are private to this personal workspace; sample assignees do not receive notifications.</p>
      </section>
    </div>
  );
}
