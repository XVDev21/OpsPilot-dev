import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import operationsCaseFixture from "../../contracts/v1/operations-case.json";
import operationsCaseListFixture from "../../contracts/v1/operations-case-list.json";
import workspaceMembersFixture from "../../contracts/v1/workspace-members.json";
import { QueryProvider } from "@/components/providers/query-provider";
import { CasesList } from "@/features/cases/cases-list";
import { browserApi } from "@/lib/api/browser-client";
import {
  operationsCaseDetailSchema,
  operationsCaseListSchema,
  workspaceMemberListSchema,
} from "@/lib/api/schemas";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe("operations case register", () => {
  it("renders persisted case ownership and opens a reviewed case", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "listWorkspaceMembers").mockResolvedValue(
      workspaceMemberListSchema.parse(workspaceMembersFixture),
    );
    vi.spyOn(browserApi, "listCases").mockResolvedValue(
      operationsCaseListSchema.parse(operationsCaseListFixture),
    );
    const create = vi.spyOn(browserApi, "createCase").mockResolvedValue(
      operationsCaseDetailSchema.parse(operationsCaseFixture),
    );

    render(
      <QueryProvider>
        <CasesList />
      </QueryProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Holiday field is missing" })).toBeInTheDocument();
    expect(screen.getAllByText("Mina Park").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Case title"), "Payroll holiday configuration");
    await user.type(
      screen.getByLabelText("Reported outcome and context"),
      "The consultant cannot see the Holiday field in a client payroll run.",
    );
    await user.selectOptions(
      screen.getByLabelText("Owner"),
      "5e677b3b-a0f4-463d-af5c-0dfc13d8467a",
    );
    await user.click(screen.getByRole("button", { name: "Open case" }));

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Payroll holiday configuration",
        assigneeId: "5e677b3b-a0f4-463d-af5c-0dfc13d8467a",
      }),
    );
    expect(push).toHaveBeenCalledWith(
      "/app/cases/7fc3b3bd-9361-43f0-87d2-8b7d96e5a0cc",
    );
  });
});
