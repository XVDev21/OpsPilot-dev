"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, Check, ChevronDown, LoaderCircle, ShieldCheck } from "lucide-react";
import { usePathname } from "next/navigation";
import { switchWorkspaceAction } from "@/app/app/actions";
import { browserApi } from "@/lib/api/browser-client";
import { cn } from "@/lib/utils";

export function WorkspaceSwitcher({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const context = useQuery({
    queryKey: ["workspace-context"],
    queryFn: browserApi.workspaceContext,
  });
  const current = context.data?.items.find(
    (workspace) => workspace.id === context.data.currentWorkspaceId,
  );
  const workspaces =
    context.data?.items.filter(
      (workspace) => workspace.id === current?.id || Boolean(workspace.workosOrganizationId),
    ) ?? [];

  if (context.isPending) {
    return (
      <div className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface-soft px-3 text-xs text-foreground-muted">
        <LoaderCircle aria-hidden="true" className="size-4 animate-spin text-primary motion-reduce:animate-none" />
        Loading workspace
      </div>
    );
  }
  if (!current) return null;

  return (
    <details className="group relative">
      <summary className="flex min-h-13 list-none cursor-pointer items-center gap-3 rounded-xl border border-border bg-surface-raised px-3 py-2.5 shadow-[var(--shadow-sm)] transition-colors marker:hidden hover:border-primary/35 [&::-webkit-details-marker]:hidden">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
          {current.collaborationState === "active" ? (
            <ShieldCheck aria-hidden="true" className="size-4" />
          ) : (
            <Building2 aria-hidden="true" className="size-4" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-bold text-foreground">{current.name}</span>
          {!compact ? (
            <span className="mt-0.5 block text-[0.6875rem] capitalize text-foreground-soft">
              {current.accessRole} · {current.collaborationState}
            </span>
          ) : null}
        </span>
        <ChevronDown aria-hidden="true" className="size-3.5 text-foreground-soft transition-transform group-open:rotate-180" />
      </summary>
      <div className={cn(
        "z-40 mt-2 w-full rounded-2xl border border-border bg-surface-raised p-2 shadow-[var(--shadow-panel)]",
        !compact && "md:absolute md:left-0",
      )}>
        <p className="px-2 py-1.5 text-[0.6875rem] font-bold tracking-[0.08em] text-foreground-soft uppercase">
          Your workspaces
        </p>
        {workspaces.map((workspace) => {
          const selected = workspace.id === current.id;
          const canSwitch = Boolean(workspace.workosOrganizationId) && !selected;
          return (
            <form key={workspace.id} action={switchWorkspaceAction}>
              <input type="hidden" name="organizationId" value={workspace.workosOrganizationId || ""} />
              <input type="hidden" name="returnTo" value={pathname || "/app"} />
              <button
                type="submit"
                disabled={!canSwitch}
                className={cn(
                  "flex min-h-11 w-full items-center gap-3 rounded-xl px-2.5 text-left text-sm transition-colors",
                  canSwitch && "hover:bg-surface-soft",
                  selected ? "text-foreground" : "text-foreground-muted",
                )}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-surface-soft text-primary">
                  <Building2 aria-hidden="true" className="size-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate font-semibold">{workspace.name}</span>
                {selected ? <Check aria-hidden="true" className="size-4 text-success" /> : null}
              </button>
            </form>
          );
        })}
        {current.collaborationState === "active" && !current.workosOrganizationId ? (
          <p className="px-2 py-2 text-xs leading-5 text-warning">
            Organization setup needs attention from the workspace owner.
          </p>
        ) : null}
      </div>
    </details>
  );
}
