import Link from "next/link";
import { ArrowRight, CheckCircle2, FileText, WandSparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowIcon } from "@/features/workflows/workflow-icon";
import type { WorkflowDefinition } from "@/features/workflows/types";
import { cn } from "@/lib/utils";

export function WorkflowShowcase({
  workflow,
  index,
}: {
  workflow: WorkflowDefinition;
  index: number;
}) {
  return (
    <section className="marketing-section border-t border-border first:border-t-0">
      <div className="page-container grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className={cn(index % 2 === 1 && "lg:order-2")}>
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary">
              <WorkflowIcon name={workflow.icon} />
            </span>
            <Badge>{workflow.category}</Badge>
          </div>
          <h2 className="mt-7 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
            {workflow.title}
          </h2>
          <p className="mt-4 text-base leading-7 text-foreground-muted">{workflow.problem}</p>
          <div className="mt-6 border-l-2 border-primary pl-4">
            <p className="text-sm font-semibold leading-6 text-foreground">{workflow.benefit}</p>
            <p className="mt-1 text-xs leading-5 text-foreground-soft">
              Automation benefit: replaces repeated setup and formatting while keeping review with the user.
            </p>
          </div>
          <Button asChild variant="secondary" className="mt-7">
            <Link href={`/app/workflows/${workflow.id}`}>
              Try this workflow <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>

        <div className={cn("grid gap-3", index % 2 === 1 && "lg:order-1")}>
          <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
            <div className="flex items-center gap-2 border-b border-border pb-4">
              <FileText aria-hidden="true" className="size-4 text-foreground-soft" />
              <span className="text-xs font-bold tracking-wider text-foreground-soft uppercase">Example input</span>
            </div>
            <div className="mt-4 grid gap-2.5">
              {workflow.inputPreview.map((item, itemIndex) => (
                <div key={item} className="flex items-center gap-3 rounded-xl bg-surface-soft px-3 py-3">
                  <span className="font-mono text-[0.625rem] text-foreground-soft">0{itemIndex + 1}</span>
                  <span className="text-sm font-medium text-foreground-muted">{item}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-5 rounded-[var(--radius-panel)] border border-primary/20 bg-surface-accent p-5 shadow-[var(--shadow-md)] sm:ml-12 sm:p-6">
            <div className="flex items-center gap-2 border-b border-primary/15 pb-4">
              <WandSparkles aria-hidden="true" className="size-4 text-primary" />
              <span className="text-xs font-bold tracking-wider text-primary uppercase">Result preview</span>
            </div>
            <div className="mt-4 grid gap-3">
              {workflow.resultPreview.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm font-semibold text-foreground">
                  <CheckCircle2 aria-hidden="true" className="size-4 text-success" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
