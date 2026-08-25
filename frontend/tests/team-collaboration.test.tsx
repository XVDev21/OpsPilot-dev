import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { switchWorkspaceAction } from "@/app/app/actions";
import { QueryProvider } from "@/components/providers/query-provider";
import { TeamDirectory } from "@/features/team/team-directory";
import { browserApi } from "@/lib/api/browser-client";
import type { WorkspaceContext, WorkspaceMemberList } from "@/lib/api/types";

vi.mock("@/app/app/actions", () => ({
  switchWorkspaceAction: vi.fn(),
}));

const workspaceId = "bb68a9f1-d548-4860-a29a-a77036f0a4e2";
const memberId = "214721a0-0abf-4753-bf8c-3ec46ef945d2";
const sampleId = "5e677b3b-a0f4-463d-af5c-0dfc13d8467a";

const personalContext: WorkspaceContext = {
  currentWorkspaceId: workspaceId,
  items: [
    {
      id: workspaceId,
      name: "Personal workspace",
      workosOrganizationId: null,
      collaborationState: "personal",
      accessRole: "owner",
      isCurrent: true,
    },
  ],
};

const activeContext: WorkspaceContext = {
  currentWorkspaceId: workspaceId,
  items: [
    {
      ...personalContext.items[0],
      name: "Operations Control",
      workosOrganizationId: "org_test_opspilot",
      collaborationState: "active",
    },
  ],
};

const members: WorkspaceMemberList = {
  items: [
    {
      id: memberId,
      key: "workspace-owner",
      name: "Case Owner",
      email: "owner@example.com",
      initials: "CO",
      role: "Workspace owner",
      discipline: "Operations",
      focus: "Owns case routing decisions.",
      availability: "Available",
      workflowFit: ["Case ownership"],
      tone: "neutral",
      isSample: false,
      linkedAccount: true,
      accessRole: "owner",
      membershipState: "active",
      isActive: true,
      workosManaged: true,
      joinedAt: "2026-08-25T01:00:00Z",
      assignedCaseCount: 2,
      openTaskCount: 1,
    },
    {
      id: sampleId,
      key: "sample-mina-park",
      name: "Mina Park",
      email: "mina.park@example.invalid",
      initials: "MP",
      role: "Software engineer",
      discipline: "Engineering",
      focus: "Owns evidence-backed code changes.",
      availability: "Focused",
      workflowFit: ["Bug fixing"],
      tone: "indigo",
      isSample: true,
      linkedAccount: false,
      accessRole: "contributor",
      membershipState: "sample",
      isActive: true,
      workosManaged: false,
      joinedAt: null,
      assignedCaseCount: 1,
      openTaskCount: 0,
    },
  ],
};

function renderTeam() {
  return render(
    <QueryProvider>
      <TeamDirectory />
    </QueryProvider>,
  );
}

describe("workspace collaboration team control plane", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.mocked(switchWorkspaceAction).mockResolvedValue(undefined);
    vi.spyOn(browserApi, "listWorkspaceMembers").mockResolvedValue(members);
    vi.spyOn(browserApi, "listWorkspaceInvitations").mockResolvedValue({ items: [] });
  });

  it("activates collaboration and refreshes the WorkOS organization session", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "workspaceContext").mockResolvedValue(personalContext);
    const activate = vi
      .spyOn(browserApi, "activateWorkspaceCollaboration")
      .mockResolvedValue(activeContext);

    renderTeam();
    await user.click(await screen.findByRole("button", { name: "Enable collaboration" }));

    await waitFor(() => expect(activate).toHaveBeenCalledOnce());
    expect(switchWorkspaceAction).toHaveBeenCalledOnce();
    const data = vi.mocked(switchWorkspaceAction).mock.calls[0][0];
    expect(data.get("organizationId")).toBe("org_test_opspilot");
    expect(data.get("returnTo")).toBe("/app/team");
  });

  it("shows workload, sample replacement, and sends a real invitation", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "workspaceContext").mockResolvedValue(activeContext);
    const invite = vi.spyOn(browserApi, "inviteWorkspaceMember").mockResolvedValue({
      id: "9f0e3744-3914-486f-9622-bac0b55e1ded",
      email: "engineer@example.com",
      accessRole: "contributor",
      state: "pending",
      targetMemberId: sampleId,
      targetMemberName: "Mina Park",
      expiresAt: "2026-09-08T01:00:00Z",
      acceptedAt: null,
      revokedAt: null,
      createdAt: "2026-08-25T01:00:00Z",
    });

    renderTeam();
    expect(await screen.findByText("Operations Control")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Invite teammate" }));
    await user.type(screen.getByLabelText("Work email"), "engineer@example.com");
    await user.selectOptions(screen.getByLabelText("Replace a sample profile"), sampleId);
    await user.click(screen.getByRole("button", { name: "Send invitation" }));

    await waitFor(() => expect(invite).toHaveBeenCalledOnce());
    expect(invite.mock.calls[0][0]).toEqual({
        email: "engineer@example.com",
        accessRole: "contributor",
        targetMemberId: sampleId,
      });
    expect(await screen.findByText(/Invitation sent/)).toBeInTheDocument();
  });

  it("keeps the deterministic demo roster independent from live APIs", () => {
    render(
      <QueryProvider>
        <TeamDirectory workflowHref="/demo/workflows" />
      </QueryProvider>,
    );
    expect(screen.getByText("A sample delivery pod for deterministic routing")).toBeInTheDocument();
    expect(screen.getByText("Mina Park")).toBeInTheDocument();
  });
});
