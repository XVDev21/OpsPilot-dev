import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  Database,
  KeyRound,
  Laptop,
  Scale,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Security",
  description: "How OpsPilot Demo Mode works today and the planned security boundary for live workflows.",
};

const plannedControls = [
  {
    icon: KeyRound,
    title: "WorkOS account security",
    body: "Part 2 adds WorkOS AuthKit and Google Social Login. Access tokens will remain out of browser storage.",
  },
  {
    icon: ShieldCheck,
    title: "Verified API requests",
    body: "Django will validate token signature and claims before accepting authenticated workflow requests.",
  },
  {
    icon: Database,
    title: "User-owned history",
    body: "When history is introduced, saved runs will be scoped to the authenticated user and checked server-side.",
  },
  {
    icon: BrainCircuit,
    title: "Provider boundary",
    body: "Live workflow input will be sent only through the configured backend AI provider adapter, never directly from the frontend.",
  },
];

export default function SecurityPage() {
  return (
    <MarketingShell>
      <main id="main-content">
        <section className="border-b border-border">
          <div className="page-container grid gap-12 py-16 md:grid-cols-[1fr_0.75fr] md:items-center md:py-24">
            <div>
              <Badge tone="success">Truthful by phase</Badge>
              <h1 className="mt-5 max-w-3xl text-balance text-[clamp(2.6rem,6vw,4.9rem)] leading-[1.02] font-extrabold tracking-[-0.06em] text-foreground">
                A clear boundary between demo and live processing.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-foreground-muted sm:text-lg">
                OpsPilot’s security story is presented as it exists today. Planned controls are labeled as planned, with no implied certifications or finished infrastructure.
              </p>
            </div>
            <div className="paper-grid rounded-[1.75rem] border border-border bg-surface-raised p-6 shadow-[var(--shadow-md)]">
              <Laptop aria-hidden="true" className="size-8 text-primary" />
              <p className="mt-8 text-xs font-bold tracking-wider text-primary uppercase">Frontend Part 1</p>
              <h2 className="mt-2 text-xl font-bold text-foreground">Demo Mode stays deterministic</h2>
              <p className="mt-3 text-sm leading-7 text-foreground-muted">
                Forms validate in the browser and render local fixtures through final schemas. No AI provider request is made, and inputs are not persisted automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="planned-heading">
          <div className="page-container">
            <div className="grid gap-6 md:grid-cols-[0.72fr_1.28fr]">
              <div>
                <p className="section-kicker">Planned live architecture</p>
                <h2 id="planned-heading" className="mt-3 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
                  Controls follow the data path.
                </h2>
                <p className="mt-4 text-sm leading-7 text-foreground-muted">
                  These controls arrive with authentication and the Django service in later approved phases.
                </p>
              </div>
              <div className="grid gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border bg-border sm:grid-cols-2">
                {plannedControls.map((control) => (
                  <article key={control.title} className="bg-surface-raised p-6">
                    <span className="grid size-10 place-items-center rounded-xl bg-surface-accent text-primary">
                      <control.icon aria-hidden="true" className="size-4.5" />
                    </span>
                    <h3 className="mt-6 text-base font-bold text-foreground">{control.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-foreground-muted">{control.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="marketing-section border-y border-border bg-surface/50">
          <div className="page-container grid gap-8 lg:grid-cols-3">
            <article className="lg:col-span-2">
              <div className="flex items-center gap-3">
                <Scale aria-hidden="true" className="size-5 text-warning" />
                <h2 className="text-xl font-bold text-foreground">Technical triage remains advisory</h2>
              </div>
              <p className="mt-4 max-w-3xl text-base leading-8 text-foreground-muted">
                Bug Triage organizes supplied evidence and suggests checks. It does not prove a root cause, authorize a production change, or replace engineering review. Confidence and evidence gaps remain visible in the result.
              </p>
            </article>
            <article className="border-t border-border pt-7 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-8">
              <UserCheck aria-hidden="true" className="size-5 text-success" />
              <h2 className="mt-4 text-lg font-bold text-foreground">User control stays central</h2>
              <p className="mt-3 text-sm leading-7 text-foreground-muted">
                Users choose what to submit, review every result, and decide where the artifact is used.
              </p>
            </article>
          </div>
        </section>

        <section className="marketing-section">
          <div className="page-container flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">See it in context</p>
              <h2 className="mt-3 max-w-2xl text-3xl font-bold tracking-[-0.04em] text-foreground">
                Explore the visible workflow boundary in Demo Mode.
              </h2>
            </div>
            <Button asChild size="lg">
              <Link href="/app/workflows">Open workflows <ArrowRight aria-hidden="true" className="size-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
