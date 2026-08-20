import { ArrowRight, BadgeCheck, CircleDot, ShieldCheck, UsersRound } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { sampleTeamMembers } from "@/lib/collaboration/sample-team";
import { cn } from "@/lib/utils";

const toneClasses = {
  indigo: "bg-primary/12 text-primary",
  cyan: "bg-accent/12 text-accent-strong",
  amber: "bg-warning/12 text-warning",
} as const;

const laneSteps = [
  ["01", "Validate intake", "Operations checks settings, permissions, and the smallest reliable reproduction."],
  ["02", "Route the work", "Support closes configuration issues; evidence-backed code gaps move to engineering."],
  ["03", "Deliver and report", "Engineering ships the change while Quality verifies it and Status Update communicates progress."],
] as const;

export function TeamDirectory({ workflowHref = "/app/workflows" }: { workflowHref?: Route }) {
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]">
        <div className="grid gap-6 p-5 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">Sample workspace</Badge>
              <Badge tone="neutral">5 fictional profiles</Badge>
            </div>
            <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
              A delivery pod built around clean handoffs
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground-muted sm:text-base sm:leading-7">
              These profiles are explicit sample data—not real identities or login accounts. Use them to demonstrate routing and ownership until WorkOS organizations, invitations, and role assignments are introduced.
            </p>
          </div>
          <div className="rounded-2xl border border-primary/15 bg-surface-accent p-4">
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ShieldCheck aria-hidden="true" className="size-4.5" />
              </span>
              <div>
                <p className="text-sm font-bold text-foreground">Prototype boundary</p>
                <p className="mt-1 text-xs leading-5 text-foreground-muted">Selections add workflow context only; they do not grant access or send notifications.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid border-t border-border lg:grid-cols-3">
          {laneSteps.map(([number, title, description]) => (
            <div key={number} className="border-b border-border p-5 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0 sm:p-6">
              <span className="font-mono text-xs font-bold text-primary">{number}</span>
              <h2 className="mt-3 text-sm font-bold text-foreground">{title}</h2>
              <p className="mt-2 text-xs leading-5 text-foreground-muted">{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="sample-team-heading">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Collaborators</p>
            <h2 id="sample-team-heading" className="mt-2 text-2xl font-bold tracking-[-0.03em] text-foreground">Seed operations team</h2>
          </div>
          <Link href={workflowHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover">
            Route a workflow <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {sampleTeamMembers.map((member) => (
            <article key={member.id} className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
              <div className="flex items-start justify-between gap-3">
                <span className={cn("grid size-12 shrink-0 place-items-center rounded-2xl text-sm font-extrabold", toneClasses[member.tone])} aria-hidden="true">
                  {member.initials}
                </span>
                <span className="inline-flex min-h-7 items-center gap-1.5 rounded-full border border-border bg-surface-soft px-2.5 text-[0.6875rem] font-semibold text-foreground-muted">
                  <CircleDot aria-hidden="true" className="size-3 text-success" /> {member.availability}
                </span>
              </div>
              <h3 className="mt-4 text-base font-bold text-foreground">{member.name}</h3>
              <p className="mt-1 text-xs font-semibold text-primary">{member.role} · {member.discipline}</p>
              <p className="mt-3 text-sm leading-6 text-foreground-muted">{member.focus}</p>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
                {member.workflowFit.map((fit) => (
                  <span key={fit} className="inline-flex min-h-7 items-center gap-1.5 rounded-full bg-surface-soft px-2.5 text-[0.6875rem] font-semibold text-foreground-muted">
                    <BadgeCheck aria-hidden="true" className="size-3 text-primary" /> {fit}
                  </span>
                ))}
              </div>
              <p className="mt-4 break-all font-mono text-[0.6875rem] text-foreground-soft">{member.email}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-[var(--radius-panel)] border border-dashed border-border-strong bg-surface-soft p-5 sm:p-6" aria-labelledby="future-team-heading">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-raised text-primary shadow-[var(--shadow-sm)]">
            <UsersRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 id="future-team-heading" className="text-base font-bold text-foreground">Ready for real membership later</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-foreground-muted">
              The next collaboration milestone can replace these fixtures with organization-scoped members, invitations, roles, availability, and auditable assignments without changing the three workflow entry points.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
