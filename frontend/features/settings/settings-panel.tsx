"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  BrainCircuit,
  Check,
  CloudOff,
  Database,
  FlaskConical,
  Gauge,
  LoaderCircle,
  Network,
  RadioTower,
  ShieldCheck,
  Sparkles,
  UserRound,
  Zap,
} from "lucide-react";
import {
  useAppMode,
  type AIProvider,
  type IntelligenceLevel,
} from "@/components/providers/app-mode-provider";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Badge } from "@/components/ui/badge";
import type { AppUser } from "@/lib/auth/types";
import { browserApi } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";
import { ProviderCredentialsPanel } from "@/features/settings/provider-credentials-panel";

function PreferenceChoice<T extends string>({
  value,
  current,
  title,
  description,
  icon: Icon,
  onSelect,
  disabled,
}: {
  value: T;
  current: T;
  title: string;
  description: string;
  icon: typeof RadioTower;
  onSelect: (value: T) => void;
  disabled?: boolean;
}) {
  const selected = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={selected}
      disabled={disabled}
      className={cn(
        "grid min-h-28 grid-cols-[auto_1fr_auto] items-start gap-3 rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow] disabled:cursor-not-allowed disabled:opacity-50",
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
  const {
    mode,
    setMode,
    provider,
    setProvider,
    intelligence,
    setIntelligence,
  } = useAppMode();
  const backendUser = useQuery({ queryKey: ["backend-user"], queryFn: browserApi.currentUser });
  const executionOptions = useQuery({
    queryKey: ["execution-options"],
    queryFn: browserApi.executionOptions,
  });
  const enabledProviders = new Map(
    executionOptions.data?.providers.map((option) => [option.id, option.enabled]) ?? [],
  );

  return (
    <div className="grid gap-5">
      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="account-heading">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Account</p>
            <h2 id="account-heading" className="mt-2 text-xl font-bold text-foreground">Your personal workspace</h2>
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
                  : "The Django API could not confirm this session. Check the backend origin and WorkOS token configuration."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-primary/15 bg-surface-accent p-4">
          <Database aria-hidden="true" className="mt-0.5 size-4.5 shrink-0 text-primary" />
          <div>
            <p className="text-sm font-semibold text-foreground">Trial history is kept for {executionOptions.data?.retentionDays ?? 30} days</p>
            <p className="mt-1 text-xs leading-5 text-foreground-muted">Each live result is private to this account. Expired input and output records are automatically removed.</p>
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
          <PreferenceChoice value="live" current={mode} title="Live Mode" description="Send validated input through the authenticated Django API and save successful runs to history." icon={RadioTower} onSelect={setMode} />
          <PreferenceChoice value="demo" current={mode} title="Demo Mode" description="Generate deterministic local output with no backend request and no automatic persistence." icon={FlaskConical} onSelect={setMode} />
        </div>
      </section>

      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6" aria-labelledby="ai-heading">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">AI execution</p>
            <h2 id="ai-heading" className="mt-2 text-xl font-bold text-foreground">Tune speed, usage, and reasoning</h2>
          </div>
          <Badge tone="primary">Gemini Efficient is default</Badge>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">Provider credentials and exact model routing stay on the backend. Your choices apply only to Live Mode and are saved on this device.</p>

        <fieldset className="mt-6">
          <legend className="text-sm font-bold text-foreground">Provider</legend>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">Gemini prioritizes the default low-cost path. OpenAI and Qwen use the same validated result contracts.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <PreferenceChoice<AIProvider>
              value="gemini"
              current={provider}
              title={executionOptions.isSuccess && !enabledProviders.get("gemini") ? "Gemini · Unavailable" : "Gemini"}
              description="Default provider route, optimized for efficient structured workflow output."
              icon={Sparkles}
              onSelect={setProvider}
              disabled={executionOptions.isSuccess && !enabledProviders.get("gemini")}
            />
            <PreferenceChoice<AIProvider>
              value="openai"
              current={provider}
              title={executionOptions.isSuccess && !enabledProviders.get("openai") ? "OpenAI · Unavailable" : "OpenAI"}
              description="Alternate provider route using the same validated OpsPilot result contracts."
              icon={Bot}
              onSelect={setProvider}
              disabled={executionOptions.isSuccess && !enabledProviders.get("openai")}
            />
            <PreferenceChoice<AIProvider>
              value="qwen"
              current={provider}
              title={executionOptions.isSuccess && !enabledProviders.get("qwen") ? "Qwen · Add a key" : "Qwen"}
              description="Alibaba Cloud Model Studio route with server-pinned Qwen models."
              icon={Network}
              onSelect={setProvider}
              disabled={executionOptions.isSuccess && !enabledProviders.get("qwen")}
            />
          </div>
        </fieldset>

        <fieldset className="mt-7">
          <legend className="text-sm font-bold text-foreground">Intelligence</legend>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">Higher levels can consume more tokens and take longer. They do not bypass workflow validation or evidence guardrails.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            <PreferenceChoice<IntelligenceLevel>
              value="fast"
              current={intelligence}
              title="Efficient · Default"
              description="Lowest expected latency and token use for routine work."
              icon={Zap}
              onSelect={setIntelligence}
            />
            <PreferenceChoice<IntelligenceLevel>
              value="balanced"
              current={intelligence}
              title="Balanced"
              description="Moderate token use with more reasoning depth."
              icon={Gauge}
              onSelect={setIntelligence}
            />
            <PreferenceChoice<IntelligenceLevel>
              value="high"
              current={intelligence}
              title="Deep"
              description="Highest expected token use and latency for difficult inputs."
              icon={BrainCircuit}
              onSelect={setIntelligence}
            />
          </div>
        </fieldset>

        {executionOptions.isError ? (
          <p className="mt-5 flex min-h-11 items-center gap-2 rounded-xl border border-warning/20 bg-warning/8 px-4 text-xs text-foreground-muted">
            <CloudOff aria-hidden="true" className="size-4 shrink-0 text-warning" />
            Provider availability could not be checked. Live requests will still be validated by the backend.
          </p>
        ) : null}
      </section>

      <ProviderCredentialsPanel />
    </div>
  );
}
