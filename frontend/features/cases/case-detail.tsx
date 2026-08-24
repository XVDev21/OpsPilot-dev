"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Archive,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  Check,
  CircleDot,
  Clock3,
  LoaderCircle,
  LockKeyhole,
  Route,
  Send,
  UserRound,
  Sparkles,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { CaseAssessmentPanel } from "@/features/cases/case-assessment-panel";
import { CaseEvidencePanel } from "@/features/cases/case-evidence-panel";
import { CaseUpdatesPanel } from "@/features/cases/case-updates-panel";
import {
  allowedCaseTransitions,
  caseDispositionLabels,
  caseDispositions,
  caseIntentLabels,
  casePublicationLabels,
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
  if (event.type === "assignment-changed")
    return `Ownership moved to ${String(payload.toMemberName ?? "Unassigned")}.`;
  if (event.type === "status-changed")
    return `State changed from ${String(payload.from)} to ${String(payload.to)}.`;
  if (event.type === "disposition-changed")
    return `Disposition changed from ${String(payload.from)} to ${String(payload.to)}.`;
  if (event.type === "published")
    return "The case was published to the workspace.";
  if (event.type === "archived")
    return "The case was archived from active delivery.";
  if (event.type === "evidence-added")
    return `${String(payload.kind ?? "Case")} evidence was added.`;
  if (event.type === "evidence-removed")
    return `${String(payload.kind ?? "Case")} evidence was removed.`;
  if (event.type === "assessment-created")
    return `Assessment ${String(payload.sequence ?? "")} was saved using ${String(payload.model ?? "the selected model")}.`;
  if (event.type === "assessment-applied")
    return `Assessment ${String(payload.sequence ?? "")} was applied to the working case classification.`;
  if (event.type === "workflow-linked")
    return "A legacy workflow run was linked to this case.";
  if (event.type === "work-item-created")
    return `${String(payload.title ?? "Work item")} entered delivery.`;
  if (event.type === "work-item-updated")
    return `${String(payload.title ?? "Work item")} was updated.`;
  if (event.type === "resolution-recorded")
    return "The resolution record was updated.";
  if (event.type === "created") return "The private case draft was opened.";
  return "Case context or delivery state changed.";
}

export function CaseDetail({ caseId }: { caseId: string }) {
  const queryClient = useQueryClient();
  const detail = useQuery({
    queryKey: ["case", caseId],
    queryFn: () => browserApi.getCase(caseId),
  });
  const members = useQuery({
    queryKey: ["workspace-members"],
    queryFn: browserApi.listWorkspaceMembers,
  });
  const [dueDateDraft, setDueDateDraft] = useState<string | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState<string | null>(null);
  const [publishAssigneeId, setPublishAssigneeId] = useState("");
  const [showTaskComposer, setShowTaskComposer] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskKind, setTaskKind] = useState<"engineering" | "verification" | "investigation" | "follow-up">("engineering");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");
  const [taskDueDate, setTaskDueDate] = useState("");

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["case", caseId] }),
      queryClient.invalidateQueries({ queryKey: ["cases"] }),
      queryClient.invalidateQueries({ queryKey: ["work-items"] }),
    ]);
  }, [caseId, queryClient]);
  const updateCase = useMutation({
    mutationFn: (input: Parameters<typeof browserApi.updateCase>[1]) =>
      browserApi.updateCase(caseId, input),
    onSuccess: refresh,
  });
  const assign = useMutation({
    mutationFn: (memberId: string | null) =>
      browserApi.assignCase(caseId, memberId),
    onSuccess: refresh,
  });
  const publish = useMutation({
    mutationFn: (input: Parameters<typeof browserApi.publishCase>[1]) =>
      browserApi.publishCase(caseId, input),
    onSuccess: refresh,
  });
  const updateWork = useMutation({
    mutationFn: ({
      itemId,
      input,
    }: {
      itemId: string;
      input: Parameters<typeof browserApi.updateWorkItem>[1];
    }) => browserApi.updateWorkItem(itemId, input),
    onSuccess: refresh,
  });
  const createTask = useMutation({
    mutationFn: () => browserApi.createWorkItem({
      caseId,
      title: taskTitle,
      description: taskDescription,
      kind: taskKind,
      assigneeId: taskAssigneeId || null,
      dueDate: taskDueDate || null,
    }),
    onSuccess: async () => {
      setTaskTitle("");
      setTaskDescription("");
      setTaskAssigneeId("");
      setTaskDueDate("");
      setShowTaskComposer(false);
      await refresh();
    },
  });

  if (detail.isPending) {
    return (
      <div
        role="status"
        className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6"
      >
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-full bg-surface-accent">
            <LoaderCircle
              aria-hidden="true"
              className="size-5 animate-spin text-primary motion-reduce:animate-none"
            />
          </span>
          <div>
            <p className="text-sm font-bold text-foreground">
              Opening the case record
            </p>
            <p className="mt-1 text-xs text-foreground-muted">
              Loading evidence, assessment versions, ownership, and activity…
            </p>
          </div>
        </div>
      </div>
    );
  }
  if (detail.isError || !detail.data) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-danger/25 bg-danger/8 p-6">
        <h1 className="text-xl font-bold text-foreground">Case unavailable</h1>
        <p className="mt-2 text-sm text-foreground-muted">
          This case could not be loaded or is outside your workspace.
        </p>
        <Button asChild variant="secondary" className="mt-5">
          <Link href="/app/cases">
            <ArrowLeft aria-hidden="true" className="size-4" /> Back to cases
          </Link>
        </Button>
      </div>
    );
  }

  const item = detail.data;
  const dueDate = dueDateDraft ?? item.dueDate ?? "";
  const resolution = resolutionDraft ?? item.resolutionSummary;
  const transitionOptions = [
    item.status,
    ...allowedCaseTransitions[item.status],
  ];
  const mutationError =
    updateCase.error || assign.error || publish.error || updateWork.error;
  const published = item.publicationState === "published";
  const appliedAssessment = item.assessments.find((assessment) => assessment.isApplied);
  const advisoryRequired = item.intent === "issue";
  const publicationReady = !advisoryRequired || Boolean(appliedAssessment);

  return (
    <div className="grid gap-6">
      <nav aria-label="Breadcrumb">
        <Link
          href="/app/cases"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-foreground-muted hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" /> Case register
        </Link>
      </nav>

      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-panel)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-extrabold text-primary">
                {item.key}
              </span>
              <Badge tone={published ? "success" : "neutral"}>
                {casePublicationLabels[item.publicationState]}
              </Badge>
              <Badge>{caseIntentLabels[item.intent]}</Badge>
              <Badge
                tone={
                  item.status === "resolved" || item.status === "closed"
                    ? "success"
                    : "primary"
                }
              >
                {caseStatusLabels[item.status]}
              </Badge>
            </div>
            <h1 className="mt-4 max-w-4xl text-balance text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
              {item.title}
            </h1>
            <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-7 text-foreground-muted">
              {item.description}
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-primary uppercase">
                  Affected area
                </p>
                <p className="mt-2 text-sm text-foreground-muted">
                  {item.affectedArea || "Not specified"}
                </p>
              </div>
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-primary uppercase">
                  Expected outcome
                </p>
                <p className="mt-2 text-sm text-foreground-muted">
                  {item.expectedOutcome || "Not specified"}
                </p>
              </div>
            </div>
            {item.summary ? (
              <div className="mt-4 rounded-2xl border border-primary/15 bg-surface-accent p-4">
                <p className="text-xs font-bold tracking-[0.08em] text-primary uppercase">
                  Applied assessment summary
                </p>
                <p className="mt-2 text-sm leading-6 text-foreground">
                  {item.summary}
                </p>
              </div>
            ) : null}
            {!published && item.publicationState === "draft" ? (
              <div className="mt-7 grid gap-5 border-t border-border pt-7">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                      Draft decision workspace
                    </p>
                    <h2 className="mt-2 text-xl font-bold text-foreground">
                      Evidence before publication
                    </h2>
                    <p className="mt-1 max-w-2xl text-xs leading-5 text-foreground-muted">
                      Build the factual record, run an advisory assessment, then apply the version
                      you reviewed. Publication remains a human decision.
                    </p>
                  </div>
                  <Badge tone={publicationReady ? "success" : "warning"}>
                    {publicationReady ? "Ready for review" : "Advisory needed"}
                  </Badge>
                </div>
                <CaseEvidencePanel
                  caseId={caseId}
                  evidence={item.evidence}
                  onChanged={refresh}
                />
                <CaseAssessmentPanel
                  caseId={caseId}
                  intent={item.intent}
                  evidence={item.evidence}
                  assessments={item.assessments}
                  onChanged={refresh}
                />
              </div>
            ) : null}
          </div>

          <aside
            className="border-t border-border bg-surface-soft p-5 lg:border-t-0 lg:border-l sm:p-6"
            aria-label="Case controls"
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                Case controls
              </p>
              {published ? (
                <Send aria-hidden="true" className="size-4 text-success" />
              ) : (
                <LockKeyhole
                  aria-hidden="true"
                  className="size-4 text-foreground-soft"
                />
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-foreground-muted">
              {published
                ? "Visible to this workspace and ready for assignment."
                : item.publicationState === "archived"
                  ? "Archived from active delivery."
                  : "Private draft. AI results do not control publication."}
            </p>
            <div className="mt-5 grid gap-4">
              <div>
                <label
                  htmlFor="case-state"
                  className="text-xs font-bold text-foreground"
                >
                  State
                </label>
                <Select
                  id="case-state"
                  className="mt-1.5"
                  value={item.status}
                  disabled={updateCase.isPending}
                  onChange={(event) =>
                    updateCase.mutate({
                      status: event.target.value as CaseStatus,
                    })
                  }
                >
                  {transitionOptions.map((value) => (
                    <option key={value} value={value}>
                      {caseStatusLabels[value]}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <label
                  htmlFor="case-type"
                  className="text-xs font-bold text-foreground"
                >
                  Working disposition
                </label>
                <Select
                  id="case-type"
                  className="mt-1.5"
                  value={item.disposition}
                  disabled={updateCase.isPending}
                  onChange={(event) =>
                    updateCase.mutate({
                      disposition: event.target.value as CaseDisposition,
                    })
                  }
                >
                  {caseDispositions.map((value) => (
                    <option key={value} value={value}>
                      {caseDispositionLabels[value]}
                    </option>
                  ))}
                </Select>
              </div>
              {published ? (
                <div>
                  <label
                    htmlFor="case-owner"
                    className="text-xs font-bold text-foreground"
                  >
                    Case owner
                  </label>
                  <Select
                    id="case-owner"
                    className="mt-1.5"
                    value={item.assignee?.id ?? ""}
                    disabled={assign.isPending}
                    onChange={(event) =>
                      assign.mutate(event.target.value || null)
                    }
                  >
                    <option value="">Unassigned</option>
                    {members.data?.items.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.isSample ? " · sample" : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              ) : item.publicationState === "draft" ? (
                <div className="rounded-2xl border border-primary/20 bg-surface-accent p-4">
                  <div className="mb-4 grid gap-2">
                    <p className="text-[0.6875rem] font-bold tracking-[0.08em] text-primary uppercase">
                      Publication basis
                    </p>
                    <div className="flex items-start gap-2 text-xs leading-5 text-foreground-muted">
                      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${item.evidence.length ? "bg-success/12 text-success" : "bg-warning/12 text-warning"}`}>
                        {item.evidence.length ? <Check aria-hidden="true" className="size-3" /> : "1"}
                      </span>
                      {item.evidence.length ? `${item.evidence.length} evidence item${item.evidence.length === 1 ? "" : "s"} recorded` : "Add the evidence available to you"}
                    </div>
                    <div className="flex items-start gap-2 text-xs leading-5 text-foreground-muted">
                      <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${appliedAssessment ? "bg-success/12 text-success" : "bg-warning/12 text-warning"}`}>
                        {appliedAssessment ? <Check aria-hidden="true" className="size-3" /> : "2"}
                      </span>
                      {appliedAssessment ? `Advisory ${appliedAssessment.sequence} reviewed and applied` : advisoryRequired ? "Review and apply an advisory assessment" : "Advisory assessment is optional for this case type"}
                    </div>
                  </div>
                  <label
                    htmlFor="publish-owner"
                    className="text-xs font-bold text-foreground"
                  >
                    Publish with an owner
                  </label>
                  <Select
                    id="publish-owner"
                    className="mt-1.5"
                    value={publishAssigneeId}
                    onChange={(event) =>
                      setPublishAssigneeId(event.target.value)
                    }
                  >
                    <option value="">Choose a workspace member</option>
                    {members.data?.items.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name}
                        {member.isSample ? " · sample" : ""}
                      </option>
                    ))}
                  </Select>
                  <div className="mt-3 grid gap-2">
                    <Button
                      type="button"
                      onClick={() => publish.mutate({
                        assigneeId: publishAssigneeId,
                        assessmentId: appliedAssessment?.id ?? null,
                      })}
                      disabled={!publishAssigneeId || publish.isPending || !publicationReady}
                    >
                      <UserRound aria-hidden="true" className="size-4" />{" "}
                      Publish & assign
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => publish.mutate({
                        assigneeId: null,
                        assessmentId: appliedAssessment?.id ?? null,
                      })}
                      disabled={publish.isPending || !publicationReady}
                    >
                      <Send aria-hidden="true" className="size-4" /> Publish
                      unassigned
                    </Button>
                  </div>
                  {!publicationReady ? (
                    <div className="mt-3 border-t border-primary/15 pt-3">
                      <p className="text-[0.6875rem] leading-5 text-foreground-muted">
                        If an advisory cannot be run, a workspace owner may publish with an explicit
                        human override. The exception is recorded in Case Activity.
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        className="mt-1 h-auto min-h-10 w-full text-xs"
                        onClick={() => publish.mutate({
                          assigneeId: publishAssigneeId || null,
                          assessmentId: null,
                          overrideAdvisory: true,
                        })}
                        disabled={publish.isPending}
                      >
                        <Sparkles aria-hidden="true" className="size-4" /> Publish without advisory
                      </Button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() =>
                    updateCase.mutate({ publicationState: "draft" })
                  }
                >
                  <ArrowLeft aria-hidden="true" className="size-4" /> Return to
                  draft
                </Button>
              )}
              <div>
                <label
                  htmlFor="case-due-date"
                  className="text-xs font-bold text-foreground"
                >
                  Target date
                </label>
                <div className="mt-1.5 flex gap-2">
                  <Input
                    id="case-due-date"
                    type="date"
                    value={dueDate}
                    onChange={(event) => setDueDateDraft(event.target.value)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      updateCase.mutate({ dueDate: dueDate || null })
                    }
                    disabled={
                      updateCase.isPending || dueDate === (item.dueDate ?? "")
                    }
                  >
                    Save
                  </Button>
                </div>
              </div>
              {item.publicationState !== "archived" ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="justify-start text-foreground-muted"
                  onClick={() =>
                    updateCase.mutate({ publicationState: "archived" })
                  }
                  disabled={updateCase.isPending}
                >
                  <Archive aria-hidden="true" className="size-4" /> Archive case
                </Button>
              ) : null}
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-border pt-5">
              <div className="rounded-xl bg-surface-raised p-3">
                <p className="font-mono text-lg font-bold text-foreground">
                  {item.evidence.length}
                </p>
                <p className="mt-1 text-[0.625rem] text-foreground-muted">
                  Evidence
                </p>
              </div>
              <div className="rounded-xl bg-surface-raised p-3">
                <p className="font-mono text-lg font-bold text-foreground">
                  {item.assessments.length}
                </p>
                <p className="mt-1 text-[0.625rem] text-foreground-muted">
                  Assessments
                </p>
              </div>
              <div className="rounded-xl bg-surface-raised p-3">
                <p className="font-mono text-lg font-bold text-foreground">
                  {item.confidence === null
                    ? "—"
                    : `${Math.round(item.confidence * 100)}%`}
                </p>
                <p className="mt-1 text-[0.625rem] text-foreground-muted">
                  Applied
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {mutationError ? (
        <p
          role="alert"
          className="rounded-xl border border-danger/25 bg-danger/8 p-3 text-sm text-danger"
        >
          That change was not saved. The case remains at its previous valid
          state.
        </p>
      ) : null}

      {published ? (
        <>
          <CaseEvidencePanel
            caseId={caseId}
            evidence={item.evidence}
            onChanged={refresh}
          />
          <CaseAssessmentPanel
            caseId={caseId}
            intent={item.intent}
            evidence={item.evidence}
            assessments={item.assessments}
            onChanged={refresh}
          />
          <CaseUpdatesPanel caseId={caseId} item={item} onChanged={refresh} />
        </>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
        <div className="grid gap-6">
          <section
            className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
            aria-labelledby="case-work-heading"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                  Delivery plan
                </p>
                <h2
                  id="case-work-heading"
                  className="mt-2 text-xl font-bold text-foreground"
                >
                  Case tasks
                </h2>
              </div>
              <Badge tone="primary">
                {item.completedWorkItemCount}/{item.workItemCount} complete
              </Badge>
              <Button type="button" variant="secondary" size="sm" onClick={() => setShowTaskComposer((value) => !value)}>
                <Plus aria-hidden="true" className="size-4" /> {showTaskComposer ? "Close" : "Add task"}
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-foreground-muted">
              Optional tasks break the case into owned, due-dated delivery steps while preserving
              source workflow lineage.
            </p>
            {showTaskComposer ? (
              <form
                className="mt-5 grid gap-3 rounded-2xl border border-primary/20 bg-surface-accent p-4"
                onSubmit={(event) => { event.preventDefault(); createTask.mutate(); }}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label htmlFor="case-task-title" className="text-xs font-bold text-foreground">Task title</label>
                    <Input id="case-task-title" className="mt-1.5" value={taskTitle} onChange={(event) => setTaskTitle(event.target.value)} minLength={3} maxLength={200} required />
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="case-task-description" className="text-xs font-bold text-foreground">Scope and expected completion</label>
                    <Textarea id="case-task-description" className="mt-1.5 min-h-24" value={taskDescription} onChange={(event) => setTaskDescription(event.target.value)} minLength={12} maxLength={6000} required />
                  </div>
                  <div>
                    <label htmlFor="case-task-kind" className="text-xs font-bold text-foreground">Task type</label>
                    <Select id="case-task-kind" className="mt-1.5" value={taskKind} onChange={(event) => setTaskKind(event.target.value as typeof taskKind)}>
                      <option value="engineering">Engineering</option>
                      <option value="verification">Configuration verification</option>
                      <option value="investigation">Investigation</option>
                      <option value="follow-up">Follow-up</option>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="case-task-owner" className="text-xs font-bold text-foreground">Owner</label>
                    <Select id="case-task-owner" className="mt-1.5" value={taskAssigneeId} onChange={(event) => setTaskAssigneeId(event.target.value)}>
                      <option value="">Unassigned</option>
                      {members.data?.items.map((member) => <option key={member.id} value={member.id}>{member.name}{member.isSample ? " · sample" : ""}</option>)}
                    </Select>
                  </div>
                </div>
                <div className="flex flex-wrap items-end gap-3">
                  <div>
                    <label htmlFor="case-task-due" className="text-xs font-bold text-foreground">Due date</label>
                    <Input id="case-task-due" type="date" className="mt-1.5" value={taskDueDate} onChange={(event) => setTaskDueDate(event.target.value)} />
                  </div>
                  <Button type="submit" disabled={createTask.isPending}>
                    {createTask.isPending ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus aria-hidden="true" className="size-4" />} Create task
                  </Button>
                </div>
                {createTask.isError ? <p role="alert" className="text-xs text-danger">The task was not created. The form remains available.</p> : null}
              </form>
            ) : null}
            <div className="mt-5 grid gap-3">
              {item.workItems.length ? (
                item.workItems.map((work) => (
                  <article
                    key={work.id}
                    className="rounded-2xl border border-border bg-surface-soft p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge
                          tone={
                            work.kind === "engineering" ? "warning" : "neutral"
                          }
                        >
                          {work.kind}
                        </Badge>
                        <h3 className="mt-2 text-sm font-bold text-foreground">
                          {work.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-foreground-muted">
                          {work.description}
                        </p>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs text-foreground-soft">
                        <CalendarDays aria-hidden="true" className="size-3.5" />{" "}
                        {formatCaseDate(work.dueDate)}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 border-t border-border pt-4 sm:grid-cols-2">
                      <div>
                        <label
                          htmlFor={`work-state-${work.id}`}
                          className="text-[0.6875rem] font-bold text-foreground-soft"
                        >
                          State
                        </label>
                        <Select
                          id={`work-state-${work.id}`}
                          className="mt-1 min-h-10 text-xs"
                          value={work.status}
                          disabled={updateWork.isPending}
                          onChange={(event) =>
                            updateWork.mutate({
                              itemId: work.id,
                              input: {
                                status: event.target.value as WorkItemStatus,
                              },
                            })
                          }
                        >
                          {workItemStatuses.map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </Select>
                      </div>
                      <div>
                        <label
                          htmlFor={`work-owner-${work.id}`}
                          className="text-[0.6875rem] font-bold text-foreground-soft"
                        >
                          Owner
                        </label>
                        <Select
                          id={`work-owner-${work.id}`}
                          className="mt-1 min-h-10 text-xs"
                          value={work.assignee?.id ?? ""}
                          disabled={updateWork.isPending}
                          onChange={(event) =>
                            updateWork.mutate({
                              itemId: work.id,
                              input: { assigneeId: event.target.value || null },
                            })
                          }
                        >
                          <option value="">Unassigned</option>
                          {members.data?.items.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.name}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-border-strong p-5">
                  <BriefcaseBusiness
                    aria-hidden="true"
                    className="size-5 text-primary"
                  />
                  <p className="mt-3 text-sm font-bold text-foreground">
                    No case tasks yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground-muted">
                    Tasks are optional. Use the delivery journal above for progress, decisions, and
                    resolution evidence.
                  </p>
                </div>
              )}
            </div>
          </section>

          <section
            className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
            aria-labelledby="resolution-heading"
          >
            <div className="flex items-start gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-success/10 text-success">
                <CheckCircle2 aria-hidden="true" className="size-5" />
              </span>
              <div>
                <h2
                  id="resolution-heading"
                  className="text-lg font-bold text-foreground"
                >
                  Resolution record
                </h2>
                <p className="mt-1 text-xs leading-5 text-foreground-muted">
                  Capture what changed, what was verified, and what the user
                  should expect now.
                </p>
              </div>
            </div>
            <Textarea
              className="mt-4 min-h-28"
              value={resolution}
              onChange={(event) => setResolutionDraft(event.target.value)}
              placeholder="Example: Enabled Holiday fields in Payroll Settings, verified visibility for the client role, and documented the configuration path."
              maxLength={4000}
            />
            <Button
              type="button"
              variant="secondary"
              className="mt-3"
              disabled={
                updateCase.isPending || resolution === item.resolutionSummary
              }
              onClick={() =>
                updateCase.mutate({ resolutionSummary: resolution })
              }
            >
              Save resolution
            </Button>
          </section>
        </div>

        <aside
          className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6 xl:sticky xl:top-24"
          aria-labelledby="case-activity-heading"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                Audit trail
              </p>
              <h2
                id="case-activity-heading"
                className="mt-2 text-xl font-bold text-foreground"
              >
                Case activity
              </h2>
            </div>
            <Activity aria-hidden="true" className="size-5 text-primary" />
          </div>
          <ol className="mt-6 grid gap-0">
            {item.events.map((event, index) => (
              <li
                key={event.id}
                className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 pb-5 last:pb-0"
              >
                {index < item.events.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute top-5 bottom-0 left-[0.43rem] w-px bg-border"
                  />
                ) : null}
                <span
                  className="relative mt-1 size-3 rounded-full border-2 border-surface-raised bg-primary shadow-[0_0_0_1px_var(--border)]"
                  aria-hidden="true"
                />
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-xs font-bold text-foreground">
                      {eventLabel(event.type)}
                    </h3>
                    <time
                      className="flex items-center gap-1 font-mono text-[0.625rem] text-foreground-soft"
                      dateTime={event.createdAt}
                    >
                      <Clock3 aria-hidden="true" className="size-3" />{" "}
                      {new Date(event.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-1 text-xs leading-5 text-foreground-muted">
                    {eventDescription(event)}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-[0.6875rem] font-semibold text-foreground-soft">
                    <CircleDot aria-hidden="true" className="size-3" />{" "}
                    {event.actorName}
                  </p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-primary/15 bg-surface-accent p-3">
            <Route
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0 text-primary"
            />
            <p className="text-xs leading-5 text-foreground-muted">
              Events are append-only evidence. Sample members can own work, but
              only authenticated accounts generate activity.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
