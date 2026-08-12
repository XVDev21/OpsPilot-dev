import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Layers3 } from "lucide-react";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { WorkflowShowcase } from "@/components/marketing/workflow-showcase";
import { Button } from "@/components/ui/button";
import { workflows } from "@/features/workflows/registry";

export const metadata: Metadata = {
  title: "Product",
  description: "Explore OpsPilot AI's three task-oriented automation workflows.",
};

export default function ProductPage() {
  return (
    <MarketingShell>
      <main id="main-content">
        <section className="border-b border-border">
          <div className="page-container grid gap-8 py-16 md:grid-cols-[1fr_auto] md:items-end md:py-24">
            <div>
              <p className="section-kicker">The product</p>
              <h1 className="mt-4 max-w-4xl text-balance text-[clamp(2.6rem,6vw,4.9rem)] leading-[1.02] font-extrabold tracking-[-0.06em] text-foreground">
                Known jobs. Guided inputs. Useful results.
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-foreground-muted sm:text-lg">
                OpsPilot packages repeated knowledge work as focused workflows so teams spend less time assembling prompts and more time reviewing the actual work.
              </p>
            </div>
            <div className="hidden size-28 place-items-center rounded-[1.75rem] border border-border bg-surface-raised text-primary shadow-[var(--shadow-md)] md:grid">
              <Layers3 aria-hidden="true" className="size-10" strokeWidth={1.5} />
            </div>
          </div>
        </section>

        {workflows.map((workflow, index) => (
          <WorkflowShowcase key={workflow.id} workflow={workflow} index={index} />
        ))}

        <section className="marketing-section border-t border-border bg-surface/50">
          <div className="page-container flex flex-col gap-7 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="section-kicker">Try the complete flow</p>
              <h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] text-foreground">
                All three workflows are live in Demo Mode.
              </h2>
            </div>
            <Button asChild size="lg">
              <Link href="/app/workflows">Open workflow catalog <ArrowRight aria-hidden="true" className="size-4" /></Link>
            </Button>
          </div>
        </section>
      </main>
    </MarketingShell>
  );
}
