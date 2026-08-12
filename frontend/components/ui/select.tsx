import * as React from "react";
import { cn } from "@/lib/utils";

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "min-h-11 w-full appearance-none rounded-[var(--radius-control)] border border-border bg-surface-raised px-3.5 py-2.5 pr-10 text-sm text-foreground shadow-[inset_0_1px_2px_rgb(23_32_51_/_0.04)] transition-[border-color,box-shadow] hover:border-border-strong focus:border-primary focus:outline-none focus:ring-3 focus:ring-primary/15",
        "bg-[linear-gradient(45deg,transparent_50%,var(--foreground-muted)_50%),linear-gradient(135deg,var(--foreground-muted)_50%,transparent_50%)] bg-[position:calc(100%-17px)_50%,calc(100%-12px)_50%] bg-[size:5px_5px,5px_5px] bg-no-repeat",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  ),
);
Select.displayName = "Select";
