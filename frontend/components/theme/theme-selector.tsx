"use client";

import { Laptop, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Laptop },
] as const;

export function ThemeSelector({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <div
      className={cn(
        "grid grid-cols-3 rounded-xl border border-border bg-surface-soft p-1",
        className,
      )}
      role="group"
      aria-label="Color theme"
      suppressHydrationWarning
    >
      {themes.map(({ value, label, icon: Icon }) => {
        const selected = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => setTheme(value)}
            aria-pressed={selected}
            className={cn(
              "flex min-h-10 items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-semibold text-foreground-muted transition-[background-color,color,box-shadow]",
              selected && "bg-surface-raised text-foreground shadow-[var(--shadow-sm)]",
            )}
          >
            <Icon aria-hidden="true" className="size-3.5" />
            <span className="max-[370px]:sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
