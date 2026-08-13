import Link from "next/link";
import type { Route } from "next";
import { ArrowUpRight, Menu } from "lucide-react";
import { BrandLockup } from "@/components/brand/logo-mark";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { ThemeSelector } from "@/components/theme/theme-selector";

const links = [
  { href: "/product", label: "Product" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/security", label: "Security" },
] as const satisfies readonly { href: Route; label: string }[];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/80 bg-background/88 backdrop-blur-xl">
      <div className="page-container flex h-[4.5rem] items-center justify-between gap-4">
        <Link href="/" aria-label="OpsPilot AI home" className="inline-flex min-h-11 items-center rounded-xl">
          <BrandLockup />
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-11 items-center rounded-[var(--radius-control)] px-3 text-sm font-semibold text-foreground-muted transition-colors hover:bg-surface-soft hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <Link href="/sign-in">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">
              Start free
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          </Button>
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <Button asChild>
            <Link href="/demo">Try demo</Link>
          </Button>
          <Sheet
            title="Explore OpsPilot"
            description="Choose a page or jump straight into Demo Mode."
            trigger={
              <Button variant="secondary" size="icon" aria-label="Open navigation">
                <Menu aria-hidden="true" className="size-5" />
              </Button>
            }
          >
            <nav aria-label="Mobile navigation" className="grid gap-1">
              <Link
                href="/"
                className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold hover:bg-surface-soft"
              >
                Home
              </Link>
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex min-h-12 items-center rounded-xl px-3 text-base font-semibold hover:bg-surface-soft"
                >
                  {link.label}
                </Link>
              ))}
              <Link
                href="/demo"
                className="mt-3 flex min-h-12 items-center justify-between rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"
              >
                Enter Demo Mode
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/sign-in"
                className="mt-2 flex min-h-12 items-center rounded-xl px-3 text-base font-semibold hover:bg-surface-soft"
              >
                Sign in
              </Link>
            </nav>
            <div className="mt-8 border-t border-border pt-5">
              <p className="mb-2 text-xs font-semibold tracking-wide text-foreground-muted uppercase">
                Appearance
              </p>
              <ThemeSelector />
            </div>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
