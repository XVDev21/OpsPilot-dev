"use client";

import { motion, useReducedMotion } from "motion/react";
import { Check, CornerDownRight, Sparkles } from "lucide-react";

const lanes = [
  { label: "Technical", className: "bg-primary" },
  { label: "Collaboration", className: "bg-accent" },
  { label: "Operations", className: "bg-warning" },
];

export function HeroVisual() {
  const reduceMotion = useReducedMotion();
  const transition = (delay: number) => ({
    duration: reduceMotion ? 0 : 0.55,
    delay: reduceMotion ? 0 : delay,
    ease: [0.16, 1, 0.3, 1] as const,
  });

  return (
    <div
      className="surface-shine paper-grid relative overflow-hidden rounded-[1.65rem] border border-border p-4 shadow-[var(--shadow-panel)] sm:p-6"
      role="img"
      aria-label="Rough work fragments move through three workflow lanes and become a structured result"
      data-motion="preference-aware"
    >
      <div className="absolute -top-20 -right-16 size-56 rounded-full bg-primary/12 blur-3xl" />
      <div className="relative flex items-center justify-between gap-2 pb-5">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles aria-hidden="true" className="size-4" />
          </span>
          <div>
            <p className="text-xs font-bold text-foreground">Transformation map</p>
            <p className="text-[0.6875rem] text-foreground-muted">From fragments to action</p>
          </div>
        </div>
        <span className="rounded-full border border-success/25 bg-success/10 px-2.5 py-1 text-[0.625rem] font-bold tracking-wider text-success uppercase">
          Structured
        </span>
      </div>

      <div className="relative grid min-h-[22rem] grid-cols-[0.8fr_1.05fr_1.2fr] items-center gap-2 sm:gap-4">
        <motion.div
          initial={{ opacity: 0, x: -18 }}
          animate={{ opacity: 1, x: 0 }}
          transition={transition(0.08)}
          className="grid gap-3"
        >
          {["report", "notes", "context", "?"].map((fragment, index) => (
            <div
              key={fragment}
              className={`rounded-lg border border-border bg-surface-raised p-2 shadow-[var(--shadow-sm)] ${index === 3 ? "w-2/3" : index === 1 ? "ml-3" : ""}`}
            >
              <span className="block h-1.5 w-8 rounded-full bg-foreground-soft/55" />
              <span className="mt-1.5 block h-1 w-4/5 rounded-full bg-border-strong/70" />
              <span className="sr-only">{fragment}</span>
            </div>
          ))}
        </motion.div>

        <div className="relative grid gap-3">
          <CornerDownRight
            aria-hidden="true"
            className="absolute top-1/2 -left-3 size-4 -translate-y-1/2 text-foreground-soft sm:-left-5"
          />
          {lanes.map((lane, index) => (
            <motion.div
              key={lane.label}
              initial={{ opacity: 0, scaleX: 0.76 }}
              animate={{ opacity: 1, scaleX: 1 }}
              transition={transition(0.25 + index * 0.1)}
              className="relative flex h-14 origin-left items-center rounded-xl border border-border bg-surface-soft/90 px-2.5 sm:px-3"
            >
              <span className={`mr-2 h-7 w-1 rounded-full ${lane.className}`} />
              <span className="truncate text-[0.625rem] font-bold text-foreground-muted sm:text-xs">
                {lane.label}
              </span>
              <motion.span
                className={`absolute right-2 size-2 rounded-full ${lane.className}`}
                initial={{ x: -18, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={transition(0.6 + index * 0.08)}
              />
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20, scale: 0.97 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={transition(0.72)}
          className="rounded-2xl border border-primary/20 bg-surface-raised p-3 shadow-[var(--shadow-md)] sm:p-4"
        >
          <div className="flex items-center justify-between gap-2 border-b border-border pb-3">
            <span className="text-[0.625rem] font-bold tracking-wider text-primary uppercase sm:text-xs">
              Result
            </span>
            <span className="grid size-6 place-items-center rounded-full bg-success/12 text-success">
              <Check aria-hidden="true" className="size-3.5" />
            </span>
          </div>
          <div className="grid gap-3 pt-3">
            {["Summary", "Actions", "Review"].map((item, index) => (
              <div key={item} className="grid grid-cols-[auto_1fr] gap-2">
                <span className="font-mono text-[0.5625rem] text-foreground-soft">0{index + 1}</span>
                <div>
                  <span className="block text-[0.625rem] font-bold text-foreground sm:text-xs">
                    {item}
                  </span>
                  <span className="mt-1 block h-1 w-full rounded-full bg-border" />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
