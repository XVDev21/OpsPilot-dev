import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { FlowStrip } from "@/components/app/flow-strip";
import { Badge } from "@/components/ui/badge";
import { WorkflowCard } from "@/features/workflows/workflow-card";
import { workflows } from "@/features/workflows/registry";

export const metadata: Metadata = {
  title: "Demo workspace",
  description: "Choose an OpsPilot workflow and run it in deterministic Demo Mode.",
};

export default function AppOverviewPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <Badge tone="primary">Demo workspace</Badge>
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
    </div>
  );
}
