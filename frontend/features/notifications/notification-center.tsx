"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  AtSign,
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock3,
  Inbox,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { browserApi } from "@/lib/api/browser-client";
import type { NotificationItem } from "@/lib/api/types";
import { cn } from "@/lib/utils";

function notificationIcon(kind: NotificationItem["kind"]) {
  if (kind === "blocker") return AlertTriangle;
  if (kind === "mention") return AtSign;
  if (kind === "assignment") return UserRoundCheck;
  if (kind === "verification" || kind === "resolution") return CheckCircle2;
  if (kind === "due-date") return Clock3;
  return Bell;
}

function notificationTone(kind: NotificationItem["kind"]) {
  if (kind === "blocker") return "text-warning bg-warning/10";
  if (kind === "verification" || kind === "resolution") return "text-success bg-success/10";
  return "text-primary bg-primary/10";
}

function timestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function NotificationFeed({
  items,
  emptyLabel = "You are caught up",
  onOpen,
}: {
  items: NotificationItem[];
  emptyLabel?: string;
  onOpen: (item: NotificationItem) => void;
}) {
  if (!items.length) {
    return (
      <div className="grid min-h-48 place-items-center rounded-2xl border border-dashed border-border-strong bg-surface-soft/60 p-6 text-center">
        <div>
          <span className="mx-auto grid size-11 place-items-center rounded-2xl bg-surface-accent text-primary">
            <Inbox aria-hidden="true" className="size-5" />
          </span>
          <p className="mt-3 text-sm font-bold text-foreground">{emptyLabel}</p>
          <p className="mt-1 text-xs leading-5 text-foreground-muted">
            Assignments, blockers, mentions, and verification results will appear here.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="grid gap-2" role="list">
      {items.map((item) => {
        const Icon = notificationIcon(item.kind);
        return (
          <div key={item.id} role="listitem">
            <button
              type="button"
              onClick={() => onOpen(item)}
              className={cn(
                "group grid min-h-20 w-full grid-cols-[auto_1fr_auto] gap-3 rounded-2xl border px-3.5 py-3 text-left transition-[border-color,background-color,transform] hover:-translate-y-px hover:border-primary/30 hover:bg-surface-soft",
                item.readAt ? "border-transparent" : "border-primary/20 bg-surface-accent/55",
              )}
            >
              <span
                className={cn(
                  "grid size-9 place-items-center rounded-xl",
                  notificationTone(item.kind),
                )}
              >
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-bold text-foreground">{item.title}</span>
                  {!item.readAt ? (
                    <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" />
                  ) : null}
                </span>
                <span className="mt-1 line-clamp-2 block text-xs leading-5 text-foreground-muted">
                  {item.summary} · {item.caseTitle}
                </span>
              </span>
              <time
                className="pt-1 font-mono text-[0.625rem] text-foreground-soft"
                dateTime={item.createdAt}
              >
                {timestamp(item.createdAt)}
              </time>
            </button>
          </div>
        );
      })}
    </div>
  );
}

function NotificationPanel() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["notifications", 8],
    queryFn: () => browserApi.listNotifications(false, 8),
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
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">Case signals</p>
          <p className="mt-1 text-sm font-bold text-foreground">
            {query.data?.unreadCount ?? 0} unread
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          disabled={!query.data?.unreadCount || markAll.isPending}
          onClick={() => markAll.mutate()}
        >
          <CheckCheck aria-hidden="true" className="size-4" /> Mark all read
        </Button>
      </div>
      {query.isError ? (
        <p role="alert" className="rounded-xl border border-warning/20 bg-warning/8 p-3 text-xs leading-5 text-foreground-muted">
          Notifications could not be refreshed. Case work is still available.
        </p>
      ) : (
        <NotificationFeed items={query.data?.items ?? []} onOpen={open} />
      )}
      <Link
        href="/app/notifications"
        className="mt-3 flex min-h-11 items-center justify-center rounded-xl text-sm font-bold text-primary hover:bg-surface-accent"
      >
        Open notification inbox
      </Link>
    </div>
  );
}

function BellButton({ unreadCount }: { unreadCount: number }) {
  return (
    <span className="relative grid size-11 place-items-center rounded-xl border border-border bg-surface-raised text-foreground-muted shadow-[var(--shadow-sm)] transition-colors hover:border-primary/30 hover:text-primary">
      <Bell aria-hidden="true" className="size-4.5" />
      {unreadCount ? (
        <span className="absolute -top-1 -right-1 grid min-h-5 min-w-5 place-items-center rounded-full border-2 border-background bg-primary px-1 font-mono text-[0.625rem] font-bold text-primary-foreground">
          {Math.min(unreadCount, 99)}
        </span>
      ) : null}
    </span>
  );
}

export function NotificationCenter() {
  const query = useQuery({
    queryKey: ["notifications", 8],
    queryFn: () => browserApi.listNotifications(false, 8),
    refetchInterval: 60_000,
  });
  const unreadCount = query.data?.unreadCount ?? 0;
  return (
    <>
      <div className="md:hidden">
        <Sheet
          title="Notifications"
          description="Assignments and case signals that need your attention."
          closeLabel="Close notifications"
          trigger={
            <button type="button" aria-label={`Open notifications, ${unreadCount} unread`}>
              <BellButton unreadCount={unreadCount} />
            </button>
          }
        >
          <NotificationPanel />
        </Sheet>
      </div>
      <details className="group relative hidden md:block">
        <summary className="list-none marker:hidden [&::-webkit-details-marker]:hidden" aria-label={`Open notifications, ${unreadCount} unread`}>
          <BellButton unreadCount={unreadCount} />
        </summary>
        <div className="absolute top-[calc(100%+0.6rem)] right-0 z-40 w-[min(26rem,calc(100vw-2rem))] rounded-[var(--radius-panel)] border border-border bg-surface-raised p-4 shadow-[var(--shadow-panel)]">
          <NotificationPanel />
        </div>
      </details>
    </>
  );
}
