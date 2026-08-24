import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import operationsCaseListFixture from "../../contracts/v1/operations-case-list.json";
import workspaceMembersFixture from "../../contracts/v1/workspace-members.json";
import { QueryProvider } from "@/components/providers/query-provider";
import { WorkStatusBoard } from "@/features/cases/work-status-board";
import { browserApi } from "@/lib/api/browser-client";
import {
  operationsCaseListSchema,
  workspaceMemberListSchema,
} from "@/lib/api/schemas";

afterEach(() => vi.restoreAllMocks());

describe("Work Status", () => {
  it("shows published case delivery and filters the workspace view", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "listCases").mockResolvedValue(
      operationsCaseListSchema.parse(operationsCaseListFixture),
    );
    vi.spyOn(browserApi, "listWorkspaceMembers").mockResolvedValue(
      workspaceMemberListSchema.parse(workspaceMembersFixture),
    );

    render(<QueryProvider><WorkStatusBoard /></QueryProvider>);

    expect(await screen.findByRole("heading", { name: "Work Status" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Holiday field is missing" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Verification" }));
    expect(screen.getByText("No cases in this view")).toBeInTheDocument();
  });
});
