import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { WorkflowCard } from "@/features/workflows/workflow-card";
import { workflows } from "@/features/workflows/registry";

export const metadata: Metadata = {
  title: "Workflows",
  description: "The three available OpsPilot workflow automations.",
};

export default function WorkflowCatalogPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <Badge tone="primary">3 available workflows</Badge>
      <h1 className="mt-4 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
        Workflow catalog
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-muted">
        Pick the artifact you need. Every workflow includes guided input, validation, a deterministic sample, and a copy-ready result.
      </p>

      <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} mode="catalog" />
        ))}
      </div>
    </div>
  );
}
