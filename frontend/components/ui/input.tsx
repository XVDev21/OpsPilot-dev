import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "min-h-11 w-full rounded-[var(--radius-control)] border border-border bg-surface-raised px-3.5 py-2.5 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(23_32_51_/_0.04)] transition-[border-color,box-shadow] placeholder:text-foreground-soft hover:border-border-strong focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-60",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
