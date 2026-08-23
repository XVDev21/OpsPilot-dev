"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CircleDot,
  FolderKanban,
  LoaderCircle,
  Plus,
  Search,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  caseDispositionLabels,
  caseDispositions,
  caseStatusLabels,
  caseStatuses,
  formatCaseDate,
} from "@/features/cases/presentation";
import { browserApi } from "@/lib/api/browser-client";
import type { CaseDisposition } from "@/lib/api/types";

type CaseDraft = {
  title: string;
  description: string;
  disposition: CaseDisposition;
  assigneeId: string;
  dueDate: string;
};

const emptyDraft: CaseDraft = {
  title: "",
  description: "",
  disposition: "unclassified",
  assigneeId: "",
  dueDate: "",
};

export function CasesList() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<CaseDraft>(emptyDraft);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const members = useQuery({ queryKey: ["workspace-members"], queryFn: browserApi.listWorkspaceMembers });
  const filters = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status } : {}),
    ...(assigneeId ? { assigneeId } : {}),
  };
  const cases = useQuery({
    queryKey: ["cases", filters],
    queryFn: () => browserApi.listCases(filters),
  });
  const create = useMutation({
    mutationFn: () => browserApi.createCase({
      title: draft.title,
      description: draft.description,
      disposition: draft.disposition,
      assigneeId: draft.assigneeId || null,
      dueDate: draft.dueDate || null,
    }),
    onSuccess: async (created) => {
      await queryClient.invalidateQueries({ queryKey: ["cases"] });
      setDraft(emptyDraft);
      router.push(`/app/cases/${created.id}`);
    },
  });

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-panel)]">
        <div className="grid lg:grid-cols-[minmax(0,0.8fr)_minmax(28rem,1.2fr)]">
          <div className="paper-grid border-b border-border p-5 sm:p-7 lg:border-r lg:border-b-0">
            <Badge tone="primary">Durable operations record</Badge>
            <h1 className="mt-5 max-w-xl text-balance text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
              Keep the decision, owner, and delivery trail together
            </h1>
            <p className="mt-4 max-w-lg text-sm leading-6 text-foreground-muted sm:text-base sm:leading-7">
              An Operations Case can begin before the answer is known. Link triage, assignments,
              work, and resolution without forcing every workflow to become a case.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {[
                ["01", "Capture", "Preserve the reported outcome and operating context."],
                ["02", "Decide", "Classify configuration, process, defect, or uncertainty."],
                ["03", "Deliver", "Assign real records and track the work to resolution."],
              ].map(([number, title, text]) => (
                <div key={number} className="rounded-2xl border border-border bg-surface-raised/88 p-4">
                  <span className="font-mono text-xs font-bold text-primary">{number}</span>
                  <p className="mt-2 text-sm font-bold text-foreground">{title}</p>
                  <p className="mt-1 text-xs leading-5 text-foreground-muted">{text}</p>
                </div>
              ))}
            </div>
          </div>

          <form
            className="grid content-start gap-4 p-5 sm:p-7"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate();
            }}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-accent text-primary">
                <Plus aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">New case</p>
                <h2 className="mt-1 text-xl font-bold text-foreground">Open an operations case</h2>
              </div>
            </div>
            <div>
              <label htmlFor="case-title" className="text-xs font-bold text-foreground">Case title</label>
              <Input id="case-title" className="mt-1.5" value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} placeholder="Holiday field is missing" required minLength={3} maxLength={200} />
            </div>
            <div>
              <label htmlFor="case-description" className="text-xs font-bold text-foreground">Reported outcome and context</label>
              <Textarea id="case-description" className="mt-1.5 min-h-28" value={draft.description} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} placeholder="Describe what the user expected, what happened, and where it occurred." required minLength={12} maxLength={6000} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><label htmlFor="case-disposition" className="text-xs font-bold text-foreground">Initial disposition</label><Select id="case-disposition" className="mt-1.5" value={draft.disposition} onChange={(event) => setDraft((current) => ({ ...current, disposition: event.target.value as CaseDisposition }))}>{caseDispositions.map((value) => <option key={value} value={value}>{caseDispositionLabels[value]}</option>)}</Select></div>
              <div><label htmlFor="case-assignee" className="text-xs font-bold text-foreground">Owner</label><Select id="case-assignee" className="mt-1.5" value={draft.assigneeId} onChange={(event) => setDraft((current) => ({ ...current, assigneeId: event.target.value }))}><option value="">Unassigned</option>{members.data?.items.map((member) => <option key={member.id} value={member.id}>{member.name}{member.isSample ? " · sample" : ""}</option>)}</Select></div>
              <div><label htmlFor="case-due" className="text-xs font-bold text-foreground">Target date</label><Input id="case-due" type="date" className="mt-1.5" value={draft.dueDate} onChange={(event) => setDraft((current) => ({ ...current, dueDate: event.target.value }))} /></div>
            </div>
            {create.isError ? <p role="alert" className="text-xs text-danger">The case could not be opened. Your draft is still here.</p> : null}
            <Button type="submit" className="justify-self-start" disabled={create.isPending}>
              {create.isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <FolderKanban aria-hidden="true" className="size-4" />}
              Open case
            </Button>
          </form>
        </div>
      </section>

      <section aria-labelledby="case-register-heading">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Case register</p>
            <h2 id="case-register-heading" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground">Active decision trail</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(13rem,1fr)_11rem_13rem]">
            <label className="relative"><span className="sr-only">Search cases</span><Search aria-hidden="true" className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-foreground-soft" /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search cases" /></label>
            <Select aria-label="Filter by case state" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">All states</option>{caseStatuses.map((value) => <option key={value} value={value}>{caseStatusLabels[value]}</option>)}</Select>
            <Select aria-label="Filter by assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)}><option value="">All owners</option>{members.data?.items.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</Select>
          </div>
        </div>

        {cases.isPending ? <p role="status" className="mt-6 flex items-center gap-2 text-sm text-foreground-muted"><LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" /> Loading case register…</p> : cases.isError ? <p role="alert" className="mt-6 text-sm text-danger">Cases could not be loaded.</p> : cases.data.items.length ? (
          <div className="mt-5 grid gap-3">
            {cases.data.items.map((item) => (
              <Link key={item.id} href={`/app/cases/${item.id}`} className="group grid gap-4 rounded-2xl border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)] transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[var(--shadow-panel)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5 motion-reduce:transform-none">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><span className="font-mono text-xs font-bold text-primary">{item.key}</span><Badge tone={item.status === "resolved" || item.status === "closed" ? "success" : item.status === "needs-information" ? "warning" : "neutral"}>{caseStatusLabels[item.status]}</Badge><Badge>{caseDispositionLabels[item.disposition]}</Badge></div>
                  <h3 className="mt-3 truncate text-base font-bold text-foreground">{item.title}</h3>
                  <p className="mt-1 line-clamp-2 text-sm leading-6 text-foreground-muted">{item.summary || "No case summary yet. Open the case and run triage to add evidence."}</p>
                </div>
                <div className="grid min-w-56 gap-2 text-xs text-foreground-muted sm:justify-items-end">
                  <span className="flex items-center gap-2"><UserRound aria-hidden="true" className="size-3.5 text-primary" /> {item.assignee?.name ?? "Unassigned"}</span>
                  <span className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-3.5 text-primary" /> {formatCaseDate(item.dueDate)}</span>
                  <span className="flex items-center gap-2"><BriefcaseBusiness aria-hidden="true" className="size-3.5 text-primary" /> {item.completedWorkItemCount}/{item.workItemCount} work items done <ArrowRight aria-hidden="true" className="size-3.5 transition-transform group-hover:translate-x-1 motion-reduce:transform-none" /></span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="mt-5 rounded-[var(--radius-panel)] border border-dashed border-border-strong bg-surface-soft p-8 text-center"><CircleDot aria-hidden="true" className="mx-auto size-6 text-primary" /><h3 className="mt-4 text-base font-bold text-foreground">No cases match this view</h3><p className="mt-2 text-sm text-foreground-muted">Clear the filters or open the first durable operations case above.</p></div>
        )}
      </section>
    </div>
  );
}
