import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  id: string;
  label: string;
  description?: string;
  error?: string;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({
  id,
  label,
  description,
  error,
  optional = false,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("grid gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold text-foreground">
          {label}
        </label>
        {optional ? (
          <span className="text-xs text-foreground-soft">Optional</span>
        ) : null}
      </div>
      {description ? (
        <p id={`${id}-description`} className="text-xs leading-5 text-foreground-muted">
          {description}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
