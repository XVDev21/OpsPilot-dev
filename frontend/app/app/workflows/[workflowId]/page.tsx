import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { ManagedWorkflowRunner } from "@/features/workflows/workflow-runner";
import { getWorkflow, isWorkflowId, workflows } from "@/features/workflows/registry";
import { WorkflowIcon } from "@/features/workflows/workflow-icon";

interface WorkflowPageProps {
  params: Promise<{ workflowId: string }>;
  searchParams: Promise<{ handoff?: string; case?: string }>;
}

export function generateStaticParams() {
  return workflows.map((workflow) => ({ workflowId: workflow.id }));
}

export async function generateMetadata({ params }: WorkflowPageProps): Promise<Metadata> {
  const { workflowId } = await params;
  if (!isWorkflowId(workflowId)) return { title: "Workflow not found" };
  const workflow = getWorkflow(workflowId);
  return { title: workflow.title, description: workflow.description };
}

export default async function WorkflowPage({ params, searchParams }: WorkflowPageProps) {
  const [{ workflowId }, query] = await Promise.all([params, searchParams]);
  if (!isWorkflowId(workflowId)) notFound();
  const workflow = getWorkflow(workflowId);

  return (
    <div className="mx-auto max-w-[96rem]">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-foreground-soft">
        <Link href="/app/workflows" className="min-h-11 content-center rounded-lg hover:text-foreground">
          Workflows
        </Link>
        <ChevronRight aria-hidden="true" className="size-3.5" />
        <span aria-current="page" className="font-semibold text-foreground-muted">
          {workflow.shortTitle}
        </span>
      </nav>

      <div className="mt-4 mb-7 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-accent text-primary">
            <WorkflowIcon name={workflow.icon} />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{workflow.category}</Badge>
              <Badge tone="success">Live-ready</Badge>
            </div>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-[-0.04em] text-foreground">
              {workflow.title}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground-muted">
              {workflow.description}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-xs leading-5 text-foreground-muted sm:max-w-xs">
          Live Mode uses your authenticated API session. Switch to Demo Mode in Settings whenever you need a deterministic fallback.
        </div>
      </div>

      <ManagedWorkflowRunner
        workflowId={workflowId}
        handoffId={query.handoff ?? null}
        caseId={query.case ?? null}
      />
    </div>
  );
}
