"use client";

import Link from "next/link";
import type { Route } from "next";
import { usePathname } from "next/navigation";
import { ChevronRight, LayoutGrid, Menu, Workflow } from "lucide-react";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/logo-mark";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/app", label: "Overview", icon: LayoutGrid, exact: true },
  { href: "/app/workflows", label: "Workflows", icon: Workflow, exact: false },
] as const satisfies readonly {
  href: Route;
  label: string;
  icon: typeof LayoutGrid;
  exact: boolean;
}[];

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

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/72 p-4 backdrop-blur-xl md:flex">
        <Link href="/" aria-label="OpsPilot AI home" className="mb-8 inline-flex rounded-xl px-1">
          <BrandLockup />
        </Link>
        <AppNavigation />
        <div className="mt-auto grid gap-4 border-t border-border pt-5">
          <div className="rounded-xl bg-surface-soft p-3">
            <div className="flex items-center justify-between gap-2">
              <Badge tone="primary">Demo Mode</Badge>
              <span className="size-2 rounded-full bg-success shadow-[0_0_0_4px_color-mix(in_srgb,var(--success)_12%,transparent)]" />
            </div>
            <p className="mt-2 text-xs leading-5 text-foreground-muted">
              Local deterministic results. No provider connected.
            </p>
          </div>
          <ThemeSelector />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/88 px-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet
              side="left"
              title="OpsPilot Demo"
              description="Choose a task-oriented workflow."
              trigger={
                <Button variant="secondary" size="icon" aria-label="Open app navigation">
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              }
            >
              <AppNavigation mobile />
              <div className="mt-8 border-t border-border pt-5">
                <Badge tone="primary">Demo Mode</Badge>
                <p className="mt-2 text-xs leading-5 text-foreground-muted">
                  Results are deterministic and stay in this browser session.
                </p>
                <ThemeSelector className="mt-4" />
              </div>
            </Sheet>
            <Link href="/app" aria-label="OpsPilot app overview" className="rounded-xl">
              <BrandLockup compact />
            </Link>
          </div>
          <div className="hidden md:block">
            <p className="text-xs font-semibold tracking-[0.08em] text-foreground-soft uppercase">
              Task workspace
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="primary">Demo Mode</Badge>
            <span className="hidden text-xs text-foreground-soft sm:inline">No sign-in required</span>
          </div>
        </header>
        <main id="main-content" className="min-w-0 px-3 py-7 sm:px-6 md:px-8 md:py-9 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
