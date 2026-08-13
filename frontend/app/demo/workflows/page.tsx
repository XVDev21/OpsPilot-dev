import type { Metadata } from "next";
import { Badge } from "@/components/ui/badge";
import { WorkflowCard } from "@/features/workflows/workflow-card";
import { workflows } from "@/features/workflows/registry";

export const metadata: Metadata = {
  title: "Demo workflows",
  description: "Try all three OpsPilot workflows with deterministic results.",
};

export default function DemoWorkflowCatalogPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <Badge tone="primary">3 deterministic workflows</Badge>
      <h1 className="mt-4 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
        Demo workflow catalog
      </h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-muted">
        Use real validation and final result components without an account, backend request, or artificial loading state.
      </p>
      <div className="mt-9 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} mode="demo" />
        ))}
      </div>
    </div>
  );
}
