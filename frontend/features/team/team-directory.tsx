"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  CircleDot,
  Clock3,
  LoaderCircle,
  MailPlus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserMinus,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import { switchWorkspaceAction } from "@/app/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Sheet } from "@/components/ui/sheet";
import { browserApi } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
import type {
  WorkspaceInvitation,
  WorkspaceRosterMember,
} from "@/lib/api/types";
import { sampleTeamMembers } from "@/lib/collaboration/sample-team";
import { cn } from "@/lib/utils";

const toneClasses = {
  indigo: "bg-primary/12 text-primary",
  cyan: "bg-accent/12 text-accent",
  amber: "bg-warning/12 text-warning",
  neutral: "bg-surface-soft text-foreground-muted",
} as const;

const roleLabels = {
  owner: "Owner",
  operator: "Operator",
  contributor: "Contributor",
  viewer: "Viewer",
} as const;

type RosterView = "active" | "sample" | "inactive";

function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "OpsPilot could not complete that change.";
}

function SampleTeamPreview({ workflowHref }: { workflowHref: Route }) {
  return (
    <div className="grid gap-6">
      <section className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <Badge tone="primary">Demo roster</Badge>
        <h1 className="mt-4 text-3xl font-bold tracking-[-0.04em] text-foreground">
          A sample delivery pod for deterministic routing
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground-muted">
          These profiles are fictional and cannot sign in. Live workspaces can replace them
          with invited WorkOS users without rewriting assignment history.
        </p>
        <Link
          href={workflowHref}
          className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"
        >
          Open demo workflows <ArrowRight aria-hidden="true" className="size-4" />
        </Link>
      </section>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sampleTeamMembers.map((member) => (
          <article
            key={member.id}
            className="rounded-2xl border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)]"
          >
            <span
              className={cn(
                "grid size-11 place-items-center rounded-xl text-sm font-extrabold",
                toneClasses[member.tone],
              )}
            >
              {member.initials}
            </span>
            <h2 className="mt-4 font-bold text-foreground">{member.name}</h2>
            <p className="mt-1 text-xs font-semibold text-primary">
              {member.role} · {member.discipline}
            </p>
            <p className="mt-3 text-sm leading-6 text-foreground-muted">{member.focus}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function InvitePanel({ samples }: { samples: WorkspaceRosterMember[] }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"operator" | "contributor" | "viewer">(
    "contributor",
  );
  const [targetMemberId, setTargetMemberId] = useState("");
  const invite = useMutation({
    mutationFn: browserApi.inviteWorkspaceMember,
    onSuccess: async () => {
      setEmail("");
      setTargetMemberId("");
      await queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    invite.mutate({
      email,
      accessRole: role,
      targetMemberId: targetMemberId || null,
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="rounded-2xl border border-primary/15 bg-surface-accent p-4">
        <p className="text-sm font-bold text-foreground">WorkOS sends the invitation email</p>
        <p className="mt-1 text-xs leading-5 text-foreground-muted">
          OpsPilot stores the role and optional sample-profile replacement. It never stores an
          invitation token.
        </p>
      </div>
      <Field
        id="invite-email"
        label="Work email"
        description="The invitation is scoped to this workspace."
      >
        <Input
          id="invite-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="teammate@company.com"
        />
      </Field>
      <Field
        id="invite-role"
        label="Workspace role"
        description="Operators manage cases. Contributors update assigned work. Viewers have read-only published access."
      >
        <Select
          id="invite-role"
          value={role}
          onChange={(event) => setRole(event.target.value as typeof role)}
        >
          <option value="operator">Operator</option>
          <option value="contributor">Contributor</option>
          <option value="viewer">Viewer</option>
        </Select>
      </Field>
      <Field
        id="sample-profile"
        label="Replace a sample profile"
        optional
        description="Preserves the sample profile ID and all earlier assignments."
      >
        <Select
          id="sample-profile"
          value={targetMemberId}
          onChange={(event) => setTargetMemberId(event.target.value)}
        >
          <option value="">Create a new member profile</option>
          {samples.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name} · {member.role}
            </option>
          ))}
        </Select>
      </Field>
      {invite.isError ? (
        <p role="alert" className="rounded-xl bg-danger/10 p-3 text-sm text-danger">
          {errorMessage(invite.error)}
        </p>
      ) : null}
      {invite.isSuccess ? (
        <p role="status" className="rounded-xl bg-success/10 p-3 text-sm text-success">
          Invitation sent. Its status will update after acceptance.
        </p>
      ) : null}
      <Button type="submit" disabled={invite.isPending || !email.trim()}>
        {invite.isPending ? (
          <LoaderCircle
            aria-hidden="true"
            className="size-4 animate-spin motion-reduce:animate-none"
          />
        ) : (
          <MailPlus aria-hidden="true" className="size-4" />
        )}
        {invite.isPending ? "Sending…" : "Send invitation"}
      </Button>
    </form>
  );
}

function MemberRow({
  member,
  canManage,
}: {
  member: WorkspaceRosterMember;
  canManage: boolean;
}) {
  const queryClient = useQueryClient();
  const update = useMutation({
    mutationFn: (input: {
      accessRole?: "operator" | "contributor" | "viewer";
      active?: boolean;
    }) => browserApi.updateWorkspaceMember(member.id, input),
    onSuccess: async () =>
      queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
  });
  const activeWork = member.assignedCaseCount + member.openTaskCount;

  return (
    <article className="grid gap-4 border-b border-border px-4 py-5 last:border-b-0 sm:px-5 lg:grid-cols-[minmax(15rem,1.35fr)_minmax(10rem,.8fr)_8rem_11rem] lg:items-center">
      <div className="flex min-w-0 items-start gap-3.5">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-xl text-xs font-extrabold",
            toneClasses[member.tone],
          )}
          aria-hidden="true"
        >
          {member.initials}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-bold text-foreground">{member.name}</h3>
            {member.isSample ? <Badge tone="neutral">Sample</Badge> : null}
            {member.workosManaged ? <Badge tone="success">WorkOS</Badge> : null}
          </div>
          <p className="mt-1 truncate text-xs text-foreground-muted">
            {member.email || member.role}
          </p>
          <p className="mt-2 text-xs leading-5 text-foreground-soft lg:hidden">
            {member.focus}
          </p>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-foreground">{member.role}</p>
        <p className="mt-1 text-xs text-foreground-soft">
          {member.discipline} · {member.availability}
        </p>
      </div>
      <div>
        <p className="font-mono text-lg font-bold text-foreground">{activeWork}</p>
        <p className="text-[0.6875rem] text-foreground-soft">
          {member.assignedCaseCount} cases · {member.openTaskCount} tasks
        </p>
      </div>
      <div className="flex items-center gap-2 lg:justify-end">
        {canManage && member.accessRole !== "owner" && member.isActive ? (
          <>
            <Select
              aria-label={`Role for ${member.name}`}
              value={member.accessRole}
              disabled={update.isPending || member.isSample}
              onChange={(event) =>
                update.mutate({
                  accessRole: event.target.value as "operator" | "contributor" | "viewer",
                })
              }
              className="min-h-10 py-2 text-xs"
            >
              <option value="operator">Operator</option>
              <option value="contributor">Contributor</option>
              <option value="viewer">Viewer</option>
            </Select>
            {!member.isSample ? (
              <ConfirmDialog
                title={`Remove ${member.name}?`}
                description="Their sign-in access will be deactivated in WorkOS. Case history and authored activity remain attributable."
                confirmLabel="Remove access"
                pending={update.isPending}
                onConfirm={() => update.mutate({ active: false })}
                trigger={
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove ${member.name}`}
                  >
                    <UserMinus aria-hidden="true" className="size-4" />
                  </Button>
                }
              />
            ) : null}
          </>
        ) : (
          <Badge tone={member.isActive ? "neutral" : "warning"}>
            {member.isActive ? roleLabels[member.accessRole] : "Inactive"}
          </Badge>
        )}
      </div>
      {update.isError ? (
        <p role="alert" className="text-xs text-danger lg:col-span-4">
          {errorMessage(update.error)}
        </p>
      ) : null}
    </article>
  );
}

const invitationTones = {
  pending: "warning",
  accepted: "success",
  expired: "neutral",
  revoked: "neutral",
  failed: "warning",
} as const;

function InvitationRow({ invitation }: { invitation: WorkspaceInvitation }) {
  const queryClient = useQueryClient();
  const refreshInvitations = () =>
    queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] });
  const resend = useMutation({
    mutationFn: () => browserApi.resendWorkspaceInvitation(invitation.id),
    onSuccess: refreshInvitations,
  });
  const revoke = useMutation({
    mutationFn: () => browserApi.revokeWorkspaceInvitation(invitation.id),
    onSuccess: refreshInvitations,
  });
  const mutationError = resend.error || revoke.error;

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-bold text-foreground">{invitation.email}</p>
          <Badge tone={invitationTones[invitation.state]}>{invitation.state}</Badge>
        </div>
        <p className="mt-1 text-xs text-foreground-muted">
          {roleLabels[invitation.accessRole]}
          {invitation.targetMemberName ? ` · replaces ${invitation.targetMemberName}` : ""}
        </p>
        {mutationError ? (
          <p role="alert" className="mt-2 text-xs text-danger">
            {errorMessage(mutationError)}
          </p>
        ) : null}
      </div>
      {invitation.state === "pending" ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={resend.isPending || revoke.isPending}
            onClick={() => resend.mutate()}
          >
            {resend.isPending ? "Resending…" : "Resend"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={resend.isPending || revoke.isPending}
            onClick={() => revoke.mutate()}
          >
            {revoke.isPending ? "Revoking…" : "Revoke"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function LiveTeamDirectory() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<RosterView>("active");
  const context = useQuery({
    queryKey: ["workspace-context"],
    queryFn: browserApi.workspaceContext,
  });
  const current = context.data?.items.find(
    (workspace) => workspace.id === context.data.currentWorkspaceId,
  );
  const members = useQuery({
    queryKey: ["workspace-members"],
    queryFn: browserApi.listWorkspaceMembers,
  });
  const canManage = current?.accessRole === "owner";
  const collaborationActive = current?.collaborationState === "active";
  const invitations = useQuery({
    queryKey: ["workspace-invitations"],
    queryFn: browserApi.listWorkspaceInvitations,
    enabled: Boolean(canManage && collaborationActive && current?.workosOrganizationId),
  });
  const activate = useMutation({
    mutationFn: () => browserApi.activateWorkspaceCollaboration(),
    onSuccess: async (nextContext) => {
      queryClient.setQueryData(["workspace-context"], nextContext);
      const workspace = nextContext.items.find(
        (item) => item.id === nextContext.currentWorkspaceId,
      );
      if (workspace?.workosOrganizationId) {
        const data = new FormData();
        data.set("organizationId", workspace.workosOrganizationId);
        data.set("returnTo", "/app/team");
        await switchWorkspaceAction(data);
      }
    },
  });
  const reconcile = useMutation({
    mutationFn: browserApi.reconcileWorkspace,
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["workspace-members"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-invitations"] }),
        queryClient.invalidateQueries({ queryKey: ["workspace-context"] }),
      ]);
    },
  });
  const allMembers = useMemo(() => members.data?.items ?? [], [members.data?.items]);
  const roster = useMemo(
    () =>
      allMembers.filter((member) => {
        if (view === "sample") return member.isSample && member.isActive;
        if (view === "inactive") return !member.isActive;
        return member.isActive && !member.isSample;
      }),
    [allMembers, view],
  );
  const samples = allMembers.filter((member) => member.isSample && member.isActive);
  const invitationItems = invitations.data?.items ?? [];
  const pending = invitationItems.filter((item) => item.state === "pending");
  const openLoad = allMembers.reduce(
    (total, member) => total + member.assignedCaseCount + member.openTaskCount,
    0,
  );
  const metrics: Array<{ value: number; label: string; icon: LucideIcon }> = [
    {
      value: allMembers.filter((member) => member.isActive && !member.isSample).length,
      label: "Active people",
      icon: ShieldCheck,
    },
    { value: openLoad, label: "Open assignments", icon: CircleDot },
    { value: pending.length, label: "Pending invites", icon: Clock3 },
  ];

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]">
        <div className="relative grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="pointer-events-none absolute -top-28 right-8 size-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={collaborationActive ? "success" : "primary"}>
                {collaborationActive ? "Collaboration active" : "Personal workspace"}
              </Badge>
              <Badge tone="neutral">{current?.name || "Workspace"}</Badge>
            </div>
            <h1 className="mt-4 max-w-3xl text-balance text-3xl font-bold tracking-[-0.045em] text-foreground sm:text-4xl">
              The people accountable for operational delivery
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-foreground-muted sm:text-base sm:leading-7">
              Manage real access, preserve sample assignment history, and see who owns active
              work. Identity membership comes from WorkOS; OpsPilot remains the source of case
              roles and audit history.
            </p>
          </div>
          <div className="relative flex flex-wrap gap-2">
            {canManage && collaborationActive ? (
              <Button
                type="button"
                variant="secondary"
                onClick={() => reconcile.mutate()}
                disabled={reconcile.isPending}
              >
                <RefreshCw
                  aria-hidden="true"
                  className={cn(
                    "size-4",
                    reconcile.isPending && "animate-spin motion-reduce:animate-none",
                  )}
                />
                Sync directory
              </Button>
            ) : null}
            {canManage && collaborationActive ? (
              <Sheet
                title="Invite a teammate"
                description="Grant real workspace access or replace a sample profile."
                trigger={
                  <Button type="button">
                    <MailPlus aria-hidden="true" className="size-4" /> Invite teammate
                  </Button>
                }
              >
                <InvitePanel samples={samples} />
              </Sheet>
            ) : null}
          </div>
        </div>
        <div className="grid border-t border-border sm:grid-cols-3">
          {metrics.map(({ value, label, icon: Icon }) => (
            <div
              key={String(label)}
              className="flex items-center gap-3 border-b border-border p-5 last:border-b-0 sm:border-r sm:border-b-0 sm:last:border-r-0"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-surface-accent text-primary">
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <div>
                <p className="font-mono text-xl font-bold text-foreground">{String(value)}</p>
                <p className="text-xs text-foreground-muted">{String(label)}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {canManage && current?.collaborationState !== "active" ? (
        <section className="grid gap-5 rounded-[var(--radius-panel)] border border-primary/20 bg-surface-accent p-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:p-6">
          <span className="grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_10px_30px_color-mix(in_srgb,var(--primary)_24%,transparent)]">
            <Building2 aria-hidden="true" className="size-5" />
          </span>
          <div>
            <h2 className="font-bold text-foreground">Enable real workspace collaboration</h2>
            <p className="mt-1 text-sm leading-6 text-foreground-muted">
              Creates a WorkOS Organization and binds this workspace to organization-scoped
              sessions. Your cases and sample assignments stay in place.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => activate.mutate()}
            disabled={activate.isPending}
          >
            {activate.isPending ? (
              <LoaderCircle
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
            ) : (
              <Sparkles aria-hidden="true" className="size-4" />
            )}
            {activate.isPending ? "Enabling…" : "Enable collaboration"}
          </Button>
          {activate.isError ? (
            <p role="alert" className="text-sm text-danger sm:col-span-3">
              {errorMessage(activate.error)}
            </p>
          ) : null}
        </section>
      ) : null}

      <section
        className="overflow-hidden rounded-[var(--radius-panel)] border border-border bg-surface-raised shadow-[var(--shadow-sm)]"
        aria-labelledby="roster-heading"
      >
        <div className="flex flex-col gap-4 border-b border-border p-4 sm:flex-row sm:items-end sm:justify-between sm:p-5">
          <div>
            <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
              Workspace roster
            </p>
            <h2
              id="roster-heading"
              className="mt-2 text-xl font-bold tracking-[-0.03em] text-foreground"
            >
              People, access, and workload
            </h2>
          </div>
          <div role="tablist" aria-label="Roster view" className="flex rounded-xl bg-surface-soft p-1">
            {(["active", "sample", "inactive"] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={view === item}
                onClick={() => setView(item)}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-xs font-bold capitalize text-foreground-muted",
                  view === item && "bg-surface-raised text-foreground shadow-[var(--shadow-sm)]",
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
        {members.isPending ? (
          <p role="status" className="flex items-center gap-2 p-5 text-sm text-foreground-muted">
            <LoaderCircle
              aria-hidden="true"
              className="size-4 animate-spin text-primary motion-reduce:animate-none"
            />
            Loading workspace roster…
          </p>
        ) : null}
        {members.isError ? (
          <div className="p-5">
            <p role="alert" className="text-sm text-danger">
              {errorMessage(members.error)}
            </p>
            {members.error instanceof ApiError &&
            members.error.code === "WORKSPACE_SELECTION_REQUIRED" ? (
              <p className="mt-2 text-xs text-foreground-muted">
                Use the workspace selector in the sidebar to refresh the organization session.
              </p>
            ) : null}
          </div>
        ) : null}
        {!members.isPending && !members.isError && roster.length === 0 ? (
          <div className="p-8 text-center">
            <UsersRound aria-hidden="true" className="mx-auto size-6 text-foreground-soft" />
            <p className="mt-3 text-sm font-bold text-foreground">No members in this view</p>
            <p className="mt-1 text-xs text-foreground-muted">
              Choose another roster tab or invite a teammate.
            </p>
          </div>
        ) : null}
        {roster.map((member) => (
          <MemberRow key={member.id} member={member} canManage={Boolean(canManage)} />
        ))}
      </section>

      {canManage && collaborationActive ? (
        <section
          className="rounded-[var(--radius-panel)] border border-border bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
          aria-labelledby="invitation-heading"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold tracking-[0.1em] text-primary uppercase">
                Access lifecycle
              </p>
              <h2 id="invitation-heading" className="mt-2 text-lg font-bold text-foreground">
                Invitation activity
              </h2>
            </div>
            <Badge tone={pending.length ? "warning" : "neutral"}>{pending.length}</Badge>
          </div>
          <div className="mt-4 divide-y divide-border border-y border-border">
            {invitationItems.length === 0 ? (
              <p className="py-5 text-sm text-foreground-muted">
                No workspace invitations have been sent yet.
              </p>
            ) : (
              invitationItems.map((invitation) => (
                <InvitationRow key={invitation.id} invitation={invitation} />
              ))
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function TeamDirectory({ workflowHref = "/app/cases" }: { workflowHref?: Route }) {
  if (workflowHref.startsWith("/demo")) {
    return <SampleTeamPreview workflowHref={workflowHref} />;
  }
  return <LiveTeamDirectory />;
}
