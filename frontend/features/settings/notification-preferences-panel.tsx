"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, Check, CloudOff, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { browserApi } from "@/lib/api/browser-client";
import type { NotificationPreferences, UpdateNotificationPreferencesInput } from "@/lib/api/types";
import { cn } from "@/lib/utils";

const events = [
  ["assignment", "Case assignments", "When a case is assigned directly to you."],
  ["blocker", "Blockers", "When delivery is blocked and needs attention."],
  ["mention", "Mentions", "When a teammate explicitly includes you in an update."],
  ["resolution", "Resolution review", "When a proposed resolution is ready for review."],
  ["verification", "Verification results", "When verification passes or returns to delivery."],
  ["dueDate", "Due-date changes", "When the target date changes on your assigned case."],
] as const;

type EventKey = (typeof events)[number][0];

function Switch({ checked, label, onChange, disabled }: { checked: boolean; label: string; onChange: (checked: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-7 w-12 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
        checked ? "border-primary bg-primary" : "border-border-strong bg-surface-soft",
      )}
    >
      <span className={cn("absolute top-0.5 grid size-5 place-items-center rounded-full bg-white text-primary shadow-sm transition-transform", checked ? "translate-x-5" : "translate-x-0.5")}>
        {checked ? <Check aria-hidden="true" className="size-3" /> : null}
      </span>
    </button>
  );
}

function EventRows({ preferences, workspace, onToggle, disabled }: { preferences: NotificationPreferences; workspace?: boolean; onToggle: (key: EventKey, value: boolean) => void; disabled: boolean }) {
  const source = workspace ? preferences.workspaceDefaults : preferences.effectiveEvents;
  return (
    <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface-soft/55">
      {events.map(([key, title, description]) => (
        <div key={key} className="flex min-h-20 items-center justify-between gap-5 px-4 py-3.5">
          <div>
            <p className="text-sm font-bold text-foreground">{title}</p>
            <p className="mt-1 text-xs leading-5 text-foreground-muted">{description}</p>
          </div>
          <Switch checked={Boolean(source[key])} label={`${title} email`} disabled={disabled} onChange={(value) => onToggle(key, value)} />
        </div>
      ))}
    </div>
  );
}

export function NotificationPreferencesPanel() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ["notification-preferences"], queryFn: browserApi.notificationPreferences });
  const save = useMutation({
    mutationFn: (input: UpdateNotificationPreferencesInput) =>
      browserApi.updateNotificationPreferences(input),
    onSuccess: (data) => queryClient.setQueryData(["notification-preferences"], data),
  });
  const data = query.data;
  const togglePersonal = (key: EventKey, value: boolean) => {
    if (!data) return;
    save.mutate({ eventOverrides: { ...data.eventOverrides, [key]: value } });
  };
  const toggleWorkspace = (key: EventKey, value: boolean) => {
    if (!data) return;
    save.mutate({ workspaceDefaults: { ...data.workspaceDefaults, [key]: value } });
  };
  return (
    <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]" aria-labelledby="notifications-heading">
      <div className="grid lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="flex items-center gap-2 text-xs font-bold tracking-[0.1em] text-primary uppercase"><BellRing aria-hidden="true" className="size-4" /> Notifications</p>
              <h2 id="notifications-heading" className="mt-2 text-xl font-bold text-foreground">Keep high-signal case work visible</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">In-app notifications remain available. Email is on by default and can be disabled without affecting the case record.</p>
            </div>
            {query.isPending ? <LoaderCircle aria-hidden="true" className="size-5 animate-spin text-primary motion-reduce:animate-none" /> : data ? <Badge tone={data.emailEnabled ? "success" : "neutral"}>Email {data.emailEnabled ? "on" : "off"}</Badge> : null}
          </div>
          {query.isError ? (
            <p role="alert" className="mt-5 rounded-xl border border-warning/20 bg-warning/8 p-4 text-sm text-foreground-muted">Notification preferences are temporarily unavailable. Existing settings were not changed.</p>
          ) : data ? (
            <>
              <div className="mt-5 flex min-h-20 items-center justify-between gap-5 rounded-2xl border border-primary/15 bg-surface-accent p-4">
                <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Mail aria-hidden="true" className="size-4.5" /></span><div><p className="text-sm font-bold text-foreground">Email delivery</p><p className="mt-1 text-xs leading-5 text-foreground-muted">Master control for your account. Personal opt-out always wins.</p></div></div>
                <Switch checked={data.emailEnabled} label="Email delivery" disabled={save.isPending} onChange={(emailEnabled) => save.mutate({ emailEnabled })} />
              </div>
              <EventRows preferences={data} onToggle={togglePersonal} disabled={save.isPending || !data.emailEnabled} />
              {data.canManageWorkspaceDefaults ? (
                <details className="mt-5 rounded-2xl border border-border bg-surface-soft/45 p-4">
                  <summary className="cursor-pointer text-sm font-bold text-foreground">Workspace email defaults</summary>
                  <p className="mt-2 text-xs leading-5 text-foreground-muted">These defaults apply until a member chooses a personal override. They never override an individual opt-out.</p>
                  <EventRows preferences={data} workspace onToggle={toggleWorkspace} disabled={save.isPending || !data.workspaceDefaults.emailEnabled} />
                </details>
              ) : null}
              {save.isError ? <p role="alert" className="mt-3 text-xs text-danger">The preference was not saved. Your previous setting remains active.</p> : null}
            </>
          ) : null}
        </div>
        <aside className="border-t border-border bg-surface-soft p-5 lg:border-t-0 lg:border-l sm:p-6">
          <span className={cn("grid size-11 place-items-center rounded-2xl", data?.providerConfigured ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>{data?.providerConfigured ? <ShieldCheck aria-hidden="true" className="size-5" /> : <CloudOff aria-hidden="true" className="size-5" />}</span>
          <p className="mt-4 text-sm font-bold text-foreground">{data?.providerConfigured ? "Resend connected" : "Email provider pending"}</p>
          <p className="mt-2 text-xs leading-5 text-foreground-muted">{data?.providerConfigured ? `Transactional email is sent as ${data.sender}.` : "In-app notifications work now. Add RESEND_API_KEY in Render when you are ready to enable email."}</p>
          <p className="mt-4 border-t border-border pt-4 text-[0.6875rem] leading-5 text-foreground-soft">No evidence images, raw AI prompts, or provider credentials are included in notification email.</p>
        </aside>
      </div>
    </section>
  );
}
