"use client";

import Image from "next/image";
import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FlaskConical,
  LayoutGrid,
  LogOut,
  Menu,
  RadioTower,
  Settings,
  UsersRound,
  FolderKanban,
} from "lucide-react";
import type { ReactNode } from "react";
import { signOutAction } from "@/app/app/actions";
import { BrandLockup } from "@/components/brand/logo-mark";
import { useAppMode } from "@/components/providers/app-mode-provider";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import type { AppUser } from "@/lib/auth/types";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/app/cases", label: "Cases", icon: FolderKanban, exact: false },
  { href: "/app/work-status", label: "Work Status", icon: RadioTower, exact: false },
  { href: "/app/team", label: "Team", icon: UsersRound, exact: false },
  { href: "/app/settings", label: "Settings", icon: Settings, exact: false },
] as const satisfies readonly {
  href: Route;
  label: string;
  icon: typeof LayoutGrid;
  exact: boolean;
}[];

const trustedAvatarHosts = new Set(["images.workoscdn.com", "lh3.googleusercontent.com"]);

function trustedAvatarUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && trustedAvatarHosts.has(url.hostname) ? value : null;
  } catch {
    return null;
  }
}

function UserAvatar({ user, size = "default" }: { user: AppUser; size?: "default" | "small" }) {
  const avatarUrl = trustedAvatarUrl(user.avatarUrl);
  const sizeClass = size === "small" ? "size-8" : "size-10";
  return (
    <span
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-xl bg-primary/12 text-xs font-extrabold text-primary",
        sizeClass,
      )}
      aria-hidden="true"
    >
      {avatarUrl ? (
        <Image src={avatarUrl} alt="" fill sizes={size === "small" ? "32px" : "40px"} className="object-cover" />
      ) : (
        user.initials
      )}
    </span>
  );
}

function AppNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={mobile ? "Mobile app navigation" : "App navigation"} className="grid gap-1">
      {navItems.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-soft hover:text-foreground",
              active && "bg-surface-accent text-primary",
            )}
          >
            <item.icon aria-hidden="true" className="size-[1.125rem]" />
            {item.label}
            <ChevronRight
              aria-hidden="true"
              className="ml-auto size-4 opacity-0 transition-opacity group-hover:opacity-100"
            />
          </Link>
        );
      })}
    </nav>
  );
}

function ModeStatus({ compact = false }: { compact?: boolean }) {
  const { mode } = useAppMode();
  const live = mode === "live";
  return (
    <div className={cn("rounded-xl bg-surface-soft", compact ? "p-3" : "p-3.5")}>
      <div className="flex items-center justify-between gap-2">
        <Badge tone={live ? "success" : "primary"}>{live ? "Live" : "Demo Mode"}</Badge>
        {live ? (
          <RadioTower aria-hidden="true" className="size-4 text-success" />
        ) : (
          <FlaskConical aria-hidden="true" className="size-4 text-primary" />
        )}
      </div>
      {!compact ? (
        <p className="mt-2 text-xs leading-5 text-foreground-muted">
          {live
            ? "Authenticated runs use the Django API when it is available."
            : "Deterministic local results with no provider request."}
        </p>
      ) : null}
    </div>
  );
}

function AccountMenu({ user }: { user: AppUser }) {
  return (
    <details className="group relative hidden sm:block">
      <summary className="flex min-h-11 list-none items-center gap-2 rounded-xl border border-border bg-surface-raised py-1.5 pr-2.5 pl-1.5 text-left shadow-[var(--shadow-sm)] transition-colors marker:hidden hover:border-primary/35 [&::-webkit-details-marker]:hidden">
        <UserAvatar user={user} size="small" />
        <span className="hidden max-w-36 truncate text-xs font-bold text-foreground lg:block">
          {user.displayName}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-foreground-soft transition-transform group-open:rotate-180" />
      </summary>
      <div className="absolute top-[calc(100%+0.5rem)] right-0 z-40 w-72 rounded-2xl border border-border bg-surface-raised p-3 shadow-[var(--shadow-panel)]">
        <div className="flex items-center gap-3 rounded-xl bg-surface-soft p-3">
          <UserAvatar user={user} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-foreground">{user.displayName}</p>
            <p className="truncate text-xs text-foreground-muted">{user.email}</p>
          </div>
        </div>
        <Link href="/app/settings" className="mt-2 flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground-muted hover:bg-surface-soft hover:text-foreground">
          <Settings aria-hidden="true" className="size-4" /> Account settings
        </Link>
        <form action={signOutAction}>
          <button type="submit" className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground-muted hover:bg-surface-soft hover:text-foreground">
            <LogOut aria-hidden="true" className="size-4" /> Sign out
          </button>
        </form>
      </div>
    </details>
  );
}

function MobileAccount({ user }: { user: AppUser }) {
  return (
    <div className="mt-6 border-t border-border pt-5">
      <div className="flex items-center gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{user.displayName}</p>
          <p className="truncate text-xs text-foreground-muted">{user.email}</p>
        </div>
      </div>
      <form action={signOutAction} className="mt-3">
        <Button type="submit" variant="secondary" className="w-full">
          <LogOut aria-hidden="true" className="size-4" /> Sign out
        </Button>
      </form>
    </div>
  );
}

export function AppShell({ children, user }: { children: ReactNode; user: AppUser }) {
  const { mode } = useAppMode();
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/72 p-4 backdrop-blur-xl md:flex">
        <Link href="/" aria-label="OpsPilot AI home" className="mb-8 inline-flex rounded-xl px-1">
          <BrandLockup />
        </Link>
        <WorkspaceSwitcher />
        <div className="h-5" />
        <AppNavigation />
        <div className="mt-auto grid gap-4 border-t border-border pt-5">
          <ModeStatus />
          <ThemeSelector />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/88 px-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet
              side="left"
              title="OpsPilot workspace"
              description="Review cases, delivery history, team records, or settings."
              trigger={
                <Button variant="secondary" size="icon" aria-label="Open app navigation">
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              }
            >
              <WorkspaceSwitcher compact />
              <div className="h-5" />
              <AppNavigation mobile />
              <div className="mt-7 border-t border-border pt-5">
                <ModeStatus />
                <ThemeSelector className="mt-4" />
              </div>
              <MobileAccount user={user} />
            </Sheet>
            <Link href="/app" aria-label="OpsPilot app overview" className="grid size-11 place-items-center rounded-xl">
              <BrandLockup compact />
            </Link>
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold tracking-[0.08em] text-foreground-soft uppercase">
              Authenticated workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone={mode === "live" ? "success" : "primary"}>
              {mode === "live" ? "Live" : "Demo"}
            </Badge>
            <AccountMenu user={user} />
          </div>
        </header>
        <main id="main-content" className="min-w-0 px-3 py-7 sm:px-6 md:px-8 md:py-9 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
