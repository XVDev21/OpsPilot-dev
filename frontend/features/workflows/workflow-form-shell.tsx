import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { AppMode } from "@/components/providers/app-mode-provider";

export function WorkflowFormShell({ children, mode }: { children: ReactNode; mode: AppMode }) {
  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-3 border-b border-border p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Input</p>
          <h2 className="mt-1 text-lg font-bold tracking-[-0.02em] text-foreground">
            Provide the work
          </h2>
          <p className="mt-1 max-w-lg text-sm leading-6 text-foreground-muted">
            Use familiar work details. The schema handles structure behind the scenes.
          </p>
        </div>
        <Badge tone={mode === "live" ? "success" : "primary"}>
          {mode === "live" ? "Live API" : "Deterministic demo"}
        </Badge>
      </div>
      {children}
    </div>
  );
}

export function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <fieldset className="grid gap-5 border-b border-border px-5 py-6 last:border-b-0 sm:px-6">
      <legend className="sr-only">{title}</legend>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs leading-5 text-foreground-muted">{description}</p>
        ) : null}
      </div>
      {children}
    </fieldset>
  );
}
