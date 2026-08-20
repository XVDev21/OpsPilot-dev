import { AlertTriangle, CheckCircle2, CircleHelp, Clock3, Route, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { BugTriageOutput } from "@/features/workflows/bug-triage/schema";
import type { MeetingActionsOutput } from "@/features/workflows/meeting-actions/schema";
import type { StatusUpdateOutput } from "@/features/workflows/status-update/schema";
import { getSampleTeamMember } from "@/lib/collaboration/sample-team";

function ResultSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border py-5 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 text-sm font-bold text-foreground">
        <span className="text-primary">{icon}</span>
        {title}
      </h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function ResultList({ items }: { items: readonly string[] }) {
  return (
    <ul className="grid gap-2.5 text-sm leading-6 text-foreground-muted">
      {items.map((item) => (
        <li key={item} className="grid grid-cols-[auto_1fr] gap-2.5">
          <CheckCircle2 aria-hidden="true" className="mt-1.5 size-3.5 text-success" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function BugResult({ output }: { output: BugTriageOutput }) {
  const confidence = Math.round(output.confidence * 100);
  const owner = output.routing.ownerId ? getSampleTeamMember(output.routing.ownerId) : null;
  const disposition = {
    "product-defect": "Probable product defect",
    "configuration-or-process": "Check settings or process first",
    "needs-more-evidence": "Gather more evidence",
  }[output.issueType];
  return (
    <div>
      <p className="text-base leading-7 font-semibold text-foreground">{output.summary}</p>
      <ResultSection title="Confirmed facts" icon={<CheckCircle2 className="size-4" />}>
        <ResultList items={output.confirmedFacts} />
      </ResultSection>
      <ResultSection title="Evidence gaps" icon={<CircleHelp className="size-4" />}>
        <ResultList items={output.evidenceGaps} />
      </ResultSection>
      <ResultSection title="Likely category" icon={<Search className="size-4" />}>
        <div className="flex flex-wrap gap-2">
          <Badge tone="accent" className="normal-case tracking-normal">
            {output.likelyCategory}
          </Badge>
          <Badge tone={output.issueType === "product-defect" ? "warning" : "primary"}>{disposition}</Badge>
        </div>
      </ResultSection>
      <ResultSection title="Suggested routing" icon={<Route className="size-4" />}>
        <div className="rounded-xl border border-border bg-surface-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold capitalize text-foreground">{output.routing.team} review</p>
            <span className="text-xs text-foreground-muted">
              {owner ? `${owner.name} · ${owner.role}` : "Owner unassigned"}
            </span>
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">{output.routing.rationale}</p>
        </div>
      </ResultSection>
      <ResultSection title="Recommended checks" icon={<Search className="size-4" />}>
        <ol className="grid gap-3">
          {output.recommendedChecks.map((check, index) => (
            <li key={check} className="grid grid-cols-[1.75rem_1fr] gap-2 text-sm leading-6 text-foreground-muted">
              <span className="grid size-7 place-items-center rounded-lg bg-surface-soft font-mono text-[0.6875rem] font-bold text-foreground">
                {index + 1}
              </span>
              {check}
            </li>
          ))}
        </ol>
      </ResultSection>
      <ResultSection title="Confidence" icon={<Clock3 className="size-4" />}>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-surface-soft px-4 py-3">
          <span className="text-sm text-foreground-muted">Based on the amount of concrete evidence supplied</span>
          <span className="font-mono text-lg font-bold text-foreground">{confidence}%</span>
        </div>
      </ResultSection>
      <div className="rounded-xl border border-warning/25 bg-warning/10 p-4 text-sm leading-6 text-foreground-muted">
        <p className="flex items-start gap-2 font-semibold text-warning">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> Human review required
        </p>
        <p className="mt-1.5">{output.humanReviewNotice}</p>
      </div>
    </div>
  );
}

export function MeetingResult({ output }: { output: MeetingActionsOutput }) {
  const coordinator = output.followUpCoordinatorId
    ? getSampleTeamMember(output.followUpCoordinatorId)
    : null;
  return (
    <div>
      <p className="text-base leading-7 font-semibold text-foreground">{output.summary}</p>
      <ResultSection title="Follow-up coordination" icon={<UserRound className="size-4" />}>
        <p className="text-sm leading-6 text-foreground-muted">
          {coordinator
            ? `${coordinator.name} · ${coordinator.role} will coordinate unresolved follow-up in this sample workspace.`
            : "No follow-up coordinator was selected. Action owners remain exactly as stated in the notes."}
        </p>
      </ResultSection>
      <ResultSection title="Decisions" icon={<CheckCircle2 className="size-4" />}>
        <ResultList items={output.decisions.length ? output.decisions : ["No explicit decisions were labeled."]} />
      </ResultSection>
      <ResultSection title="Action items" icon={<Clock3 className="size-4" />}>
        {output.actionItems.length ? (
          <div className="grid gap-3">
            {output.actionItems.map((item, index) => (
              <article key={`${item.task}-${index}`} className="rounded-xl border border-border bg-surface-soft p-4">
                <p className="text-sm font-semibold leading-6 text-foreground">{item.task}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-foreground-muted">
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-raised px-2.5">
                    <UserRound aria-hidden="true" className="size-3.5" />
                    {item.owner ?? "Owner not stated"}
                  </span>
                  <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-raised px-2.5">
                    <Clock3 aria-hidden="true" className="size-3.5" />
                    {item.deadline ?? "Deadline not stated"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">No lines labeled Action: were found.</p>
        )}
      </ResultSection>
      <ResultSection title="Open questions" icon={<CircleHelp className="size-4" />}>
        <ResultList items={output.openQuestions.length ? output.openQuestions : ["No open questions were explicitly labeled."]} />
      </ResultSection>
      <ResultSection title="Unresolved" icon={<AlertTriangle className="size-4" />}>
        <ResultList items={output.unresolvedItems} />
      </ResultSection>
    </div>
  );
}

export function StatusResult({ output }: { output: StatusUpdateOutput }) {
  const author = output.authorId ? getSampleTeamMember(output.authorId) : null;
  const groups = [
    ["Completed", output.completed, "success"],
    ["In progress", output.inProgress, "primary"],
    ["Blocked / waiting", output.blocked, "warning"],
    ["Next steps", output.nextSteps, "accent"],
  ] as const;
  return (
    <div>
      {author ? (
        <div className="mb-4 flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface-soft px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-accent font-mono text-xs font-bold text-primary">
            {author.initials}
          </span>
          <p className="text-sm text-foreground-muted">
            Update supplied by <span className="font-semibold text-foreground">{author.name}</span> · {author.role}
          </p>
        </div>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map(([title, items, tone]) => (
          <section key={title} className="rounded-xl border border-border bg-surface-soft p-4">
            <Badge tone={tone}>{title}</Badge>
            <div className="mt-3">
              <ResultList items={items} />
            </div>
          </section>
        ))}
      </div>
      <ResultSection title="Copy-ready update" icon={<CheckCircle2 className="size-4" />}>
        <blockquote className="rounded-xl border-l-3 border-primary bg-surface-accent p-4 text-sm leading-7 text-foreground">
          {output.shareableUpdate}
        </blockquote>
      </ResultSection>
    </div>
  );
}
