"use client";

import { useQuery } from "@tanstack/react-query";
import { Check, CloudOff, FlaskConical, LoaderCircle, RadioTower, ShieldCheck, UserRound } from "lucide-react";
import { useAppMode, type AppMode } from "@/components/providers/app-mode-provider";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Badge } from "@/components/ui/badge";
import type { AppUser } from "@/lib/auth/types";
import { browserApi } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";

function ModeChoice({
  value,
  current,
  title,
  description,
  icon: Icon,
  onSelect,
}: {
  value: AppMode;
  current: AppMode;
  title: string;
  description: string;
  icon: typeof RadioTower;
  onSelect: (value: AppMode) => void;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      className={cn(
        "grid min-h-28 grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow]",
        selected ? "border-primary/40 bg-surface-accent shadow-[var(--shadow-sm)]" : "border-border bg-surface-raised hover:border-primary/25",
      )}
    >
      <span className="grid size-10 place-items-center rounded-xl bg-surface-soft text-primary"><Icon aria-hidden="true" className="size-4.5" /></span>
      <span>
        <span className="block text-sm font-bold text-foreground">{title}</span>
        <span className="mt-1 block text-xs leading-5 text-foreground-muted">{description}</span>
      </span>
      <span className={cn("grid size-6 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-transparent")}>
        <Check aria-hidden="true" className="size-3.5" />
      </span>
    </button>
  );
}

export function SettingsPanel({ user }: { user: AppUser }) {
  const { mode, setMode } = useAppMode();
  const backendUser = useQuery({ queryKey: ["backend-user"], queryFn: browserApi.currentUser });

  return (
    <div className="grid gap-5">
      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="account-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Account</p>
            <h2 id="account-heading" className="mt-2 text-xl font-bold text-foreground">Your WorkOS profile</h2>
          </div>
          <span className="grid size-11 place-items-center rounded-xl bg-surface-accent text-primary"><UserRound aria-hidden="true" className="size-5" /></span>
        </div>
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2">
          <div className="bg-surface-soft p-4">
            <p className="text-xs font-semibold text-foreground-soft">Name</p>
            <p className="mt-1 text-sm font-bold text-foreground">{user.displayName}</p>
          </div>
          <div className="bg-surface-soft p-4">
            <p className="text-xs font-semibold text-foreground-soft">Email</p>
            <p className="mt-1 break-all text-sm font-bold text-foreground">{user.email}</p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-border bg-surface-soft p-4">
          {backendUser.isPending ? (
            <LoaderCircle aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 animate-spin text-primary motion-reduce:animate-none" />
          ) : backendUser.isSuccess ? (
            <ShieldCheck aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-success" />
          ) : (
            <CloudOff aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-warning" />
          )}
          <div>
            <p className="text-sm font-semibold text-foreground">
              {backendUser.isPending
                ? "Checking backend identity"
                : backendUser.isSuccess
                  ? "Backend identity connected"
                  : "Backend identity not connected yet"}
            </p>
            <p className="mt-1 text-xs leading-5 text-foreground-muted">
              {backendUser.isPending
                ? "OpsPilot is checking whether Django recognizes this WorkOS session."
                : backendUser.isSuccess
                  ? "Django recognized this WorkOS session and returned the local account record."
                  : "WorkOS authentication is active. Django account synchronization begins when the backend phase is available."}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="appearance-heading">
        <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Appearance</p>
        <h2 id="appearance-heading" className="mt-2 text-xl font-bold text-foreground">Choose how OpsPilot looks</h2>
        <p className="mt-2 text-sm leading-6 text-foreground-muted">Your preference applies across marketing, demo, and authenticated workspace pages.</p>
        <ThemeSelector className="mt-5 max-w-md" />
      </section>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="mode-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Execution mode</p>
            <h2 id="mode-heading" className="mt-2 text-xl font-bold text-foreground">Decide how workflows run</h2>
          </div>
          <Badge tone={mode === "live" ? "success" : "primary"}>Current: {mode}</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">Live Mode is the authenticated default. Demo Mode remains a clearly labeled, deterministic fallback and never presents local output as Gemini output.</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <ModeChoice value="live" current={mode} title="Live Mode" description="Send validated input through the authenticated Django API and save successful runs to history." icon={RadioTower} onSelect={setMode} />
          <ModeChoice value="demo" current={mode} title="Demo Mode" description="Generate deterministic local output with no backend request and no automatic persistence." icon={FlaskConical} onSelect={setMode} />
        </div>
      </section>
    </div>
  );
}
