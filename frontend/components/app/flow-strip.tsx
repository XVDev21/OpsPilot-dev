"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight, FileInput, Route, Rows3 } from "lucide-react";

const steps = [
  { label: "Input", detail: "Your work", icon: FileInput },
  { label: "Workflow", detail: "Known structure", icon: Route },
  { label: "Result", detail: "Ready to use", icon: Rows3 },
];

export function FlowStrip() {
  const reduceMotion = useReducedMotion();
  return (
    <div className="grid gap-2 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-3 shadow-[var(--shadow-sm)] sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:p-4">
      {steps.map((step, index) => (
        <div key={step.label} className="contents">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.35, delay: index * 0.08 }}
            className="flex min-h-16 items-center gap-3 rounded-xl bg-surface-soft px-3"
          >
            <span className="grid size-9 place-items-center rounded-lg bg-surface-raised text-primary shadow-[var(--shadow-sm)]">
              <step.icon aria-hidden="true" className="size-4" />
            </span>
            <span>
              <span className="block text-xs font-bold text-foreground">{step.label}</span>
              <span className="block text-[0.6875rem] text-foreground-muted">{step.detail}</span>
            </span>
          </motion.div>
          {index < steps.length - 1 ? (
            <ArrowRight
              aria-hidden="true"
              className="mx-auto size-4 rotate-90 text-foreground-soft sm:rotate-0"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
