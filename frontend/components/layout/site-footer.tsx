import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandLockup } from "@/components/brand/logo-mark";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface/55">
      <div className="page-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr] md:py-16">
        <div>
          <Link href="/" aria-label="OpsPilot AI home" className="inline-flex rounded-xl">
            <BrandLockup />
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-foreground-muted">
            Task-oriented automation for the internal work that should not need a new prompt every time.
          </p>
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Explore</h2>
          <div className="mt-3 grid gap-1 text-sm text-foreground-muted">
            <Link className="w-fit py-2 hover:text-foreground" href="/product">
              Product
            </Link>
            <Link className="w-fit py-2 hover:text-foreground" href="/security">
              Security
            </Link>
            <Link className="w-fit py-2 hover:text-foreground" href="/app/workflows">
              Workflows
            </Link>
          </div>
        </div>
        <div>
          <h2 className="text-sm font-bold text-foreground">Try the visible product</h2>
          <p className="mt-3 text-sm leading-6 text-foreground-muted">
            Demo Mode runs locally with deterministic, schema-validated results. No account required.
          </p>
          <Link
            href="/app"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary hover:text-primary-hover"
          >
            Open Demo Mode <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="page-container flex flex-col gap-2 py-5 text-xs text-foreground-soft sm:flex-row sm:items-center sm:justify-between">
          <span>© 2026 OpsPilot AI</span>
          <span>Built for clear, reviewable work.</span>
        </div>
      </div>
    </footer>
  );
}
