"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BellRing, CheckCheck, LoaderCircle } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { NotificationFeed } from "@/features/notifications/notification-center";
import { Button } from "@/components/ui/button";
import { browserApi } from "@/lib/api/browser-client";
import type { NotificationItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

export function NotificationsPage() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", "inbox", unreadOnly],
    queryFn: () => browserApi.listNotifications(unreadOnly, 100),
    refetchInterval: 60_000,
  });
  const markRead = useMutation({
    mutationFn: (notificationId: string) => browserApi.markNotificationRead(notificationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const markAll = useMutation({
    mutationFn: () => browserApi.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });
  const open = (item: NotificationItem) => {
    if (!item.readAt) markRead.mutate(item.id);
    router.push(item.actionPath as Route);
  };
  return (
    <div className="mx-auto max-w-5xl">
      <header className="relative overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-7">
        <div className="absolute top-0 right-0 h-40 w-40 rounded-full bg-primary/8 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-xs font-bold tracking-[0.1em] text-primary uppercase">
              <BellRing aria-hidden="true" className="size-4" /> Operations inbox
            </p>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
              Signals worth acting on
            </h1>
            <p className="mt-3 text-sm leading-6 text-foreground-muted sm:text-base">
              Assignments, blockers, mentions, and verification outcomes stay connected to the case record.
            </p>
          </div>
          <div className="grid min-w-32 rounded-2xl border border-primary/15 bg-surface-accent p-4">
            <span className="font-mono text-2xl font-bold text-primary">{query.data?.unreadCount ?? 0}</span>
            <span className="mt-1 text-xs font-semibold text-foreground-muted">Unread signals</span>
          </div>
        </div>
      </header>
      <section className="mt-5 rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4 shadow-[var(--shadow-sm)] sm:p-6" aria-label="Notification list">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex rounded-xl bg-surface-soft p-1" aria-label="Notification filters">
            {([false, true] as const).map((value) => (
              <button
                key={String(value)}
                type="button"
                aria-pressed={unreadOnly === value}
                onClick={() => setUnreadOnly(value)}
                className={cn("min-h-10 rounded-lg px-4 text-xs font-bold transition-colors", unreadOnly === value ? "bg-surface-raised text-primary shadow-[var(--shadow-sm)]" : "text-foreground-muted")}
              >
                {value ? "Unread" : "All"}
              </button>
            ))}
          </div>
          <Button variant="secondary" disabled={!query.data?.unreadCount || markAll.isPending} onClick={() => markAll.mutate()}>
            {markAll.isPending ? <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" /> : <CheckCheck className="size-4" />}
            Mark all read
          </Button>
        </div>
        {query.isPending ? (
          <div className="grid min-h-64 place-items-center text-sm text-foreground-muted"><LoaderCircle className="size-5 animate-spin text-primary motion-reduce:animate-none" /></div>
        ) : query.isError ? (
          <p role="alert" className="rounded-2xl border border-warning/20 bg-warning/8 p-5 text-sm text-foreground-muted">The inbox could not be refreshed. Try again when the live API is available.</p>
        ) : (
          <NotificationFeed items={query.data.items} emptyLabel={unreadOnly ? "No unread signals" : "No notifications yet"} onOpen={open} />
        )}
      </section>
    </div>
  );
}
