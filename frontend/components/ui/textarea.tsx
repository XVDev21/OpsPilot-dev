import * as React from "react";
import { cn } from "@/lib/utils";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-28 w-full resize-y rounded-[var(--radius-control)] border border-border bg-surface-raised px-3.5 py-3 text-sm leading-6 text-foreground shadow-[inset_0_1px_2px_rgb(23_32_51_/_0.04)] transition-[border-color,box-shadow] placeholder:text-foreground-soft hover:border-border-strong focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";
