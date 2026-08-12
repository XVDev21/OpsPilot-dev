import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      aria-hidden="true"
      className={cn("size-9", className)}
      fill="none"
    >
      <rect width="40" height="40" rx="11" fill="var(--foreground)" />
      <path d="M9 12.5h9.5v5H9z" fill="var(--primary)" />
      <path d="M21.5 12.5H31v5h-9.5z" fill="var(--accent)" />
      <path d="M9 22.5h5.5v5H9z" fill="var(--foreground-soft)" />
      <path d="M17.5 22.5H31v5H17.5z" fill="var(--surface-raised)" />
    </svg>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <LogoMark />
      {compact ? null : (
        <span className="text-[0.9375rem] font-extrabold tracking-[-0.02em] text-foreground">
          OpsPilot <span className="text-primary">AI</span>
        </span>
      )}
    </span>
  );
}
