import Link from "next/link";
import {
  ArrowRight,
  FileInput,
  Gauge,
  LockKeyhole,
  MousePointerClick,
  Rows3,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { HeroVisual } from "@/components/marketing/hero-visual";
import { Reveal } from "@/components/marketing/reveal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { WorkflowCard } from "@/features/workflows/workflow-card";
import { workflows } from "@/features/workflows/registry";

const howItWorks = [
  {
    title: "Choose the job",
    body: "Start from the outcome you need: triage an issue, extract actions, or share progress.",
    icon: MousePointerClick,
  },
  {
    title: "Provide the work",
    body: "Use the details you already have. The workflow supplies the structure and validation.",
    icon: FileInput,
  },
  {
    title: "Use the result",
    body: "Review a consistent artifact, then copy it into the tool or conversation where it belongs.",
    icon: Rows3,
  },
];

export default function Home() {
  return (
    <MarketingShell>
      <main id="main-content">
        <section className="relative overflow-hidden border-b border-border">
          <div className="page-container grid items-center gap-12 py-16 md:py-24 lg:grid-cols-[1.12fr_0.88fr] lg:gap-14 lg:py-28">
            <div className="relative z-10">
              <Badge tone="primary" className="mb-6">
                <Sparkles aria-hidden="true" className="mr-1.5 size-3" /> AI workflow automation for everyday work
              </Badge>
              <h1 className="text-balance max-w-3xl text-[clamp(2.7rem,5.5vw,4.15rem)] leading-[1.01] font-extrabold tracking-[-0.06em] text-foreground">
                Stop rewriting the same AI prompts.
              </h1>
              <p className="mt-6 max-w-xl text-base leading-7 text-foreground-muted sm:text-lg sm:leading-8">
                Choose the job you need done, provide the information you already have, and let OpsPilot turn it into a structured result.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/app/workflows">
                    Try the workflows <ArrowRight aria-hidden="true" className="size-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <Link href="#how-it-works">See how it works</Link>
                </Button>
              </div>
            </div>
            <HeroVisual />
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="workflow-heading">
          <div className="page-container">
            <Reveal>
              <div className="grid gap-5 md:grid-cols-[0.8fr_1.2fr] md:items-end">
                <div>
                  <p className="section-kicker">Workflow catalog</p>
                  <h2 id="workflow-heading" className="mt-3 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
                    Start with the work, not a blank box.
                  </h2>
                </div>
                <p className="max-w-2xl text-sm leading-7 text-foreground-muted md:justify-self-end md:text-base">
                  Each workflow gives familiar inputs a clear contract, then returns an artifact designed for the next human action.
                </p>
              </div>
            </Reveal>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {workflows.map((workflow, index) => (
                <Reveal key={workflow.id} delay={index * 0.07}>
                  <WorkflowCard workflow={workflow} />
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="marketing-section border-y border-border bg-surface/45 scroll-mt-20" aria-labelledby="how-heading">
          <div className="page-container">
            <Reveal>
              <p className="section-kicker">How it works</p>
              <h2 id="how-heading" className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
                A shorter path from scattered context to clear action.
              </h2>
            </Reveal>
            <div className="relative mt-12 grid gap-0 md:grid-cols-3">
              <div aria-hidden="true" className="absolute top-7 right-[16.66%] left-[16.66%] hidden h-px bg-border-strong md:block" />
              {howItWorks.map((step, index) => (
                <Reveal key={step.title} delay={index * 0.08}>
                  <article className="relative grid grid-cols-[auto_1fr] gap-4 border-b border-border py-7 last:border-0 md:block md:border-0 md:px-6 md:py-0 first:md:pl-0 last:md:pr-0">
                    <div className="relative z-10 grid size-14 place-items-center rounded-2xl border border-border bg-surface-raised text-primary shadow-[var(--shadow-sm)]">
                      <step.icon aria-hidden="true" className="size-5" />
                    </div>
                    <div>
                      <span className="font-mono text-[0.6875rem] font-bold text-foreground-soft">0{index + 1}</span>
                      <h3 className="mt-2 text-lg font-bold text-foreground">{step.title}</h3>
                      <p className="mt-2 text-sm leading-6 text-foreground-muted">{step.body}</p>
                    </div>
                  </article>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        <section className="marketing-section" aria-labelledby="before-after-heading">
          <div className="page-container grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-center">
            <Reveal>
              <div>
                <p className="section-kicker">Less prompt assembly</p>
                <h2 id="before-after-heading" className="mt-3 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
                  Keep attention on the work that needs judgment.
                </h2>
                <p className="mt-5 text-base leading-7 text-foreground-muted">
                  OpsPilot turns repeated prompt setup and formatting requests into a product flow with known inputs and reviewable outputs.
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.08}>
              <div className="grid gap-4 sm:grid-cols-[0.8fr_1.2fr]">
                <div className="rounded-[var(--radius-panel)] border border-border bg-surface-soft p-5">
                  <p className="text-xs font-bold tracking-wider text-foreground-muted uppercase">Every time</p>
                  <div className="mt-7 grid gap-3">
                    {["Write prompt", "Rewrite context", "Request format", "Clean output"].map((item, index) => (
                      <div key={item} className="flex items-center gap-3 text-sm text-foreground-muted">
                        <span className="grid size-7 place-items-center rounded-lg border border-border-strong font-mono text-[0.625rem]">{index + 1}</span>
                        {item}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-[var(--radius-panel)] bg-foreground p-6 text-background shadow-[var(--shadow-md)]">
                  <div aria-hidden="true" className="absolute -top-16 -right-16 size-44 rounded-full bg-primary/35 blur-3xl" />
                  <div className="relative">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold tracking-wider text-background/65 uppercase">With OpsPilot</p>
                      <WandSparkles aria-hidden="true" className="size-5 text-accent" />
                    </div>
                    <div className="mt-10 flex items-center justify-between gap-2">
                      {["Choose", "Provide", "Result"].map((item, index) => (
                        <div key={item} className="contents">
                          <div>
                            <span className="grid size-10 place-items-center rounded-xl bg-background/10 font-mono text-xs font-bold">0{index + 1}</span>
                            <span className="mt-2 block text-xs font-semibold">{item}</span>
                          </div>
                          {index < 2 ? <ArrowRight aria-hidden="true" className="size-4 text-background/40" /> : null}
                        </div>
                      ))}
                    </div>
                    <p className="mt-9 text-sm leading-6 text-background/70">
                      The result keeps the structure, evidence, and uncertainty visible for review.
                    </p>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        <section className="border-y border-border bg-surface/55">
          <div className="page-container grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
            {[
              [Rows3, "Structured workflow outputs"],
              [LockKeyhole, "User-controlled input"],
              [Gauge, "Technical findings stay reviewable"],
              [ShieldCheck, "Authenticated history later"],
            ].map(([Icon, label]) => (
              <div key={label as string} className="flex min-h-28 items-center gap-3 bg-surface px-5 py-6">
                <span className="grid size-10 place-items-center rounded-xl bg-surface-accent text-primary">
                  <Icon aria-hidden="true" className="size-4.5" />
                </span>
                <span className="text-sm font-semibold text-foreground">{label as string}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="marketing-section">
          <div className="page-container">
            <Reveal>
              <div className="relative overflow-hidden rounded-[1.75rem] border border-primary/20 bg-surface-accent px-6 py-12 sm:px-10 md:flex md:items-center md:justify-between md:gap-10 md:py-14">
                <div aria-hidden="true" className="absolute -top-28 right-0 size-72 rounded-full bg-primary/12 blur-3xl" />
                <div className="relative">
                  <p className="section-kicker">Demo Mode is ready</p>
                  <h2 className="mt-3 max-w-2xl text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">
                    Choose a job and use the result.
                  </h2>
                  <p className="mt-4 max-w-xl text-sm leading-7 text-foreground-muted">
                    Explore all three workflows with real validation and deterministic results. No account or backend is required.
                  </p>
                </div>
                <Button asChild size="lg" className="relative mt-7 shrink-0 md:mt-0">
                  <Link href="/app">Open OpsPilot Demo <ArrowRight aria-hidden="true" className="size-4" /></Link>
                </Button>
              </div>
            </Reveal>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
