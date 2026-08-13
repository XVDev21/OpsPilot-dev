"use client";

import Link from "next/link";
import { ChevronRight, FlaskConical, Home, Menu, Workflow } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BrandLockup } from "@/components/brand/logo-mark";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const demoNav = [
  { href: "/demo", label: "Overview", icon: Home, exact: true },
  { href: "/demo/workflows", label: "Workflows", icon: Workflow, exact: false },
] as const;

function DemoNavigation({ mobile = false }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <nav aria-label={mobile ? "Mobile demo navigation" : "Demo navigation"} className="grid gap-1">
      {demoNav.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-foreground-muted hover:bg-surface-soft hover:text-foreground",
              active && "bg-surface-accent text-primary",
            )}
          >
            <item.icon aria-hidden="true" className="size-[1.125rem]" />
            {item.label}
            <ChevronRight aria-hidden="true" className="ml-auto size-4 opacity-0 group-hover:opacity-100" />
          </Link>
        );
      })}
    </nav>
  );
}

function DemoStatus() {
  return (
    <div className="rounded-xl bg-surface-soft p-3.5">
      <div className="flex items-center justify-between gap-2">
        <Badge tone="primary">Demo Mode</Badge>
        <FlaskConical aria-hidden="true" className="size-4 text-primary" />
      </div>
      <p className="mt-2 text-xs leading-5 text-foreground-muted">
        Guest workspace with deterministic results and no saved history.
      </p>
    </div>
  );
}

export function DemoShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-border bg-surface/72 p-4 backdrop-blur-xl md:flex">
        <Link href="/" aria-label="OpsPilot AI home" className="mb-8 inline-flex rounded-xl px-1">
          <BrandLockup />
        </Link>
        <DemoNavigation />
        <div className="mt-auto grid gap-4 border-t border-border pt-5">
          <DemoStatus />
          <ThemeSelector />
          <Button asChild variant="secondary" className="w-full">
            <Link href="/sign-up">Create an account</Link>
          </Button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/88 px-3 backdrop-blur-xl md:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <Sheet
              side="left"
              title="OpsPilot Demo"
              description="Explore deterministic workflows without signing in."
              trigger={
                <Button variant="secondary" size="icon" aria-label="Open demo navigation">
                  <Menu aria-hidden="true" className="size-5" />
                </Button>
              }
            >
              <DemoNavigation mobile />
              <div className="mt-7 border-t border-border pt-5">
                <DemoStatus />
                <ThemeSelector className="mt-4" />
                <Button asChild variant="secondary" className="mt-4 w-full">
                  <Link href="/sign-up">Create an account</Link>
                </Button>
              </div>
            </Sheet>
            <Link href="/demo" aria-label="OpsPilot demo overview" className="grid size-11 place-items-center rounded-xl">
              <BrandLockup compact />
            </Link>
          </div>
          <p className="hidden text-xs font-semibold tracking-[0.08em] text-foreground-soft uppercase md:block">
            Guest workspace
          </p>
          <div className="flex items-center gap-2">
            <Badge tone="primary">Demo</Badge>
            <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </header>
        <main id="main-content" className="min-w-0 px-3 py-7 sm:px-6 md:px-8 md:py-9 xl:px-10">
          {children}
        </main>
      </div>
    </div>
  );
}
