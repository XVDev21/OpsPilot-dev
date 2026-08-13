import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { WorkflowIcon } from "@/features/workflows/workflow-icon";
import type { WorkflowDefinition } from "@/features/workflows/types";
import { cn } from "@/lib/utils";

const toneStyles = {
  indigo: {
    icon: "bg-primary/12 text-primary",
    line: "bg-primary",
    wash: "from-primary/14",
  },
  cyan: {
    icon: "bg-accent/12 text-accent",
    line: "bg-accent",
    wash: "from-accent/14",
  },
  amber: {
    icon: "bg-warning/12 text-warning",
    line: "bg-warning",
    wash: "from-warning/14",
  },
};

export function WorkflowCard({
  workflow,
  mode = "marketing",
}: {
  workflow: WorkflowDefinition;
  mode?: "marketing" | "app" | "catalog" | "demo";
}) {
  const tone = toneStyles[workflow.tone];
  const href = (mode === "app" || mode === "catalog"
    ? `/app/workflows/${workflow.id}`
    : `/demo/workflows/${workflow.id}`) as Route;
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex min-h-full flex-col overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] transition-[transform,border-color,box-shadow] duration-240 ease-out hover:-translate-y-1 hover:border-primary/35 hover:shadow-[var(--shadow-md)] focus-visible:-translate-y-1 sm:p-6",
        mode === "app" && "min-h-[19rem] justify-between",
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent opacity-75",
          tone.wash,
        )}
      />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <span className={cn("grid size-11 place-items-center rounded-xl", tone.icon)}>
            <WorkflowIcon name={workflow.icon} />
          </span>
          <Badge>{workflow.category}</Badge>
        </div>

        <div className="mt-8 flex h-16 items-center gap-1.5" aria-hidden="true">
          {workflow.inputPreview.map((item, index) => (
            <div key={item} className="contents">
              <span
                className={cn(
                  "h-7 rounded-md border border-border bg-surface-soft",
                  index === 0 ? "w-9" : index === 1 ? "w-6" : "w-8",
                )}
              />
              {index < workflow.inputPreview.length - 1 ? (
                <span className={cn("h-px flex-1 opacity-55", tone.line)} />
              ) : null}
            </div>
          ))}
          <span className="ml-1 grid size-8 place-items-center rounded-lg border border-success/20 bg-success/10 text-success">
            <Check className="size-4" />
          </span>
        </div>

        <h3 className="mt-5 text-xl font-bold tracking-[-0.025em] text-foreground">
          {workflow.title}
        </h3>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">{workflow.description}</p>
      </div>
      <div className="relative mt-7 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-semibold text-foreground">Open workflow</span>
        <span className="grid size-9 place-items-center rounded-lg bg-surface-soft text-foreground-muted transition-[background-color,color,transform] group-hover:translate-x-0.5 group-hover:bg-primary group-hover:text-primary-foreground">
          <ArrowUpRight aria-hidden="true" className="size-4" />
        </span>
      </div>
    </Link>
  );
}
