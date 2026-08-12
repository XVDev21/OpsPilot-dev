import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeTone = "neutral" | "primary" | "accent" | "success" | "warning";

const tones: Record<BadgeTone, string> = {
  neutral: "border-border bg-surface-soft text-foreground-muted",
  primary: "border-primary/25 bg-surface-accent text-primary",
  accent: "border-accent/25 bg-accent/10 text-accent",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
};

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex min-h-6 items-center rounded-full border px-2.5 py-0.5 text-xs font-bold tracking-[0.08em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}
