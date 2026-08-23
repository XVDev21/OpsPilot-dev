import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  FileSearch,
  FolderKanban,
  ScanSearch,
  Send,
  UsersRound,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Open, assess, publish, and deliver durable Operations Cases.",
};

export default function AppOverviewPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-panel)]">
        <div className="grid lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)]">
          <div className="paper-grid p-6 sm:p-8 lg:p-10">
            <Badge tone="success">Authenticated case workspace</Badge>
            <h1 className="mt-5 max-w-3xl text-balance text-4xl font-bold tracking-[-0.05em] text-foreground sm:text-5xl">
              Start with the case, not a disconnected prompt
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-foreground-muted">
              Capture the report and evidence once. Assess bug versus settings
              when useful, keep every model result versioned, and publish the
              work regardless of the AI recommendation.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href="/app/cases"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary-hover"
              >
                <FolderKanban aria-hidden="true" className="size-4" /> Open or
                review cases
              </Link>
              <Link
                href="/app/team"
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface-raised px-4 text-sm font-bold text-foreground hover:border-primary/35"
              >
                <UsersRound aria-hidden="true" className="size-4" /> Review
                assignees
              </Link>
            </div>
          </div>
          <div className="border-t border-border bg-surface-soft p-6 sm:p-8 lg:border-t-0 lg:border-l">
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
              Case path
            </p>
            <ol className="mt-5 grid gap-4">
              {[
                [
                  FileSearch,
                  "Private intake",
                  "Choose issue, clarification, or additional development.",
                ],
                [
                  ScanSearch,
                  "Versioned assessment",
                  "Select a configured model and compare evidence-bound results.",
                ],
                [
                  Send,
                  "Human-controlled publishing",
                  "Publish and assign without an automated approval gate.",
                ],
              ].map(([Icon, title, text], index) => (
                <li
                  key={String(title)}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="font-mono text-[0.625rem] font-bold text-foreground-soft">
                      0{index + 1}
                    </p>
                    <h2 className="mt-1 text-sm font-bold text-foreground">
                      {String(title)}
                    </h2>
                    <p className="mt-1 text-xs leading-5 text-foreground-muted">
                      {String(text)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mt-7 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        <Link
          href="/app/cases"
          className="group rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)] transition-[border-color,transform] hover:-translate-y-0.5 hover:border-primary/35 motion-reduce:transform-none"
        >
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
            Primary workspace
          </p>
          <h2 className="mt-3 text-2xl font-bold text-foreground">
            Operations Cases
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
            One durable record for intake, evidence, assessment decisions,
            ownership, delivery compatibility, resolution, and activity.
          </p>
          <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-primary">
            Enter the case register{" "}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transform-none"
            />
          </span>
        </Link>
        <div className="rounded-[var(--radius-panel)] border border-border bg-surface-soft p-6">
          <p className="text-xs font-bold tracking-[0.1em] text-foreground-soft uppercase">
            Next locked phase
          </p>
          <h2 className="mt-3 text-lg font-bold text-foreground">
            PR 3 · Work Status collaboration
          </h2>
          <p className="mt-2 text-sm leading-6 text-foreground-muted">
            Append-only progress and resolution updates, My Assigned, case
            tasks, and a workspace-wide status view—without adding email or
            external channels yet.
          </p>
        </div>
      </section>
    </div>
  );
}
