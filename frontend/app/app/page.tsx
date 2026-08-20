import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, UsersRound } from "lucide-react";
import { FlowStrip } from "@/components/app/flow-strip";
import { Badge } from "@/components/ui/badge";
import { WorkflowCard } from "@/features/workflows/workflow-card";
import { workflows } from "@/features/workflows/registry";

export const metadata: Metadata = {
  title: "Workspace",
  description: "Choose an OpsPilot workflow and produce a structured result.",
};

export default function AppOverviewPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Badge tone="success">Authenticated workspace</Badge>
          <h1 className="mt-4 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
            What would you like to automate?
          </h1>
          <p className="mt-3 text-base text-foreground-muted">Start with the task—not the prompt.</p>
        </div>
        <Link
          href="/app/workflows"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover"
        >
          View workflow catalog <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} mode="app" />
        ))}
      </div>

      <section className="mt-8" aria-labelledby="flow-heading">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="flow-heading" className="text-sm font-bold text-foreground">
            A known path for every run
          </h2>
          <span className="text-xs text-foreground-soft">Input → workflow → structured result</span>
        </div>
        <FlowStrip />
      </section>

      <section className="mt-8 flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:flex-row sm:items-center sm:justify-between sm:p-6" aria-labelledby="team-preview-heading">
        <div className="flex items-start gap-4">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface-accent text-primary">
            <UsersRound aria-hidden="true" className="size-5" />
          </span>
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Sample collaboration</p>
            <h2 id="team-preview-heading" className="mt-1 text-base font-bold text-foreground">Route work through a fictional delivery pod</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground-muted">Use clearly labeled sample profiles for intake, technical review, engineering, and verification—without presenting them as real users.</p>
          </div>
        </div>
        <Link href="/app/team" className="inline-flex min-h-11 shrink-0 items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover">
          Meet the sample team <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
    </div>
  );
}
