"use client";

import { Check, ListChecks, SlidersHorizontal } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type { AppMode } from "@/components/providers/app-mode-provider";
import type { WorkflowInputMode } from "@/features/workflows/shared-schema";
import { cn } from "@/lib/utils";

const inputModeOptions = [
  {
    id: "simple" as const,
    label: "Simple",
    description: "Only the minimum needed to produce a useful first pass.",
    icon: ListChecks,
  },
  {
    id: "advanced" as const,
    label: "Advanced",
    description: "Add evidence, routing, ownership, and delivery context.",
    icon: SlidersHorizontal,
  },
];

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

export function WorkflowInputModeSwitch({
  value,
  onChange,
}: {
  value: WorkflowInputMode;
  onChange: (value: WorkflowInputMode) => void;
}) {
  return (
    <div className="border-b border-border bg-surface-soft/70 px-5 py-4 sm:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold text-foreground">Input depth</p>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">
            Advanced context can improve routing and confidence; human review still applies.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Workflow input depth">
          {inputModeOptions.map((option) => {
            const selected = value === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onChange(option.id)}
                aria-pressed={selected}
                title={option.description}
                className={cn(
                  "grid min-h-11 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border px-3 text-left text-xs font-bold transition-[border-color,background-color,box-shadow]",
                  selected
                    ? "border-primary/35 bg-surface-raised text-foreground shadow-[var(--shadow-sm)]"
                    : "border-transparent text-foreground-muted hover:border-border-strong hover:bg-surface-raised/70",
                )}
              >
                <option.icon aria-hidden="true" className="size-3.5 text-primary" />
                {option.label}
                <Check aria-hidden="true" className={cn("size-3.5 text-primary", !selected && "opacity-0")} />
              </button>
            );
          })}
        </div>
      </div>
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
