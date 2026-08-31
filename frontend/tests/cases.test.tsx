import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import operationsCaseFixture from "../../contracts/v1/operations-case.json";
import operationsCaseListFixture from "../../contracts/v1/operations-case-list.json";
import workspaceMembersFixture from "../../contracts/v1/workspace-members.json";
import executionOptionsFixture from "../../contracts/v1/execution-options.json";
import { QueryProvider } from "@/components/providers/query-provider";
import { CaseDetail } from "@/features/cases/case-detail";
import { CasesList } from "@/features/cases/cases-list";
import { browserApi } from "@/lib/api/browser-client";
import {
  operationsCaseDetailSchema,
  operationsCaseListSchema,
  executionOptionsSchema,
  workspaceMemberListSchema,
} from "@/lib/api/schemas";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe("operations case register", () => {
  it("renders persisted cases and opens a private case-first draft", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "listWorkspaceMembers").mockResolvedValue(
      workspaceMemberListSchema.parse(workspaceMembersFixture),
    );
    vi.spyOn(browserApi, "listCases").mockResolvedValue(
      operationsCaseListSchema.parse(operationsCaseListFixture),
    );
    const create = vi
      .spyOn(browserApi, "createCase")
      .mockResolvedValue(
        operationsCaseDetailSchema.parse(operationsCaseFixture),
      );

    render(
      <QueryProvider>
        <CasesList />
      </QueryProvider>,
    );

    expect(
      await screen.findByRole("heading", { name: "Holiday field is missing" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Mina Park").length).toBeGreaterThan(0);

    await user.type(
      screen.getByLabelText("Case title"),
      "Payroll holiday configuration",
    );
    await user.type(
      screen.getByLabelText("What happened?"),
      "The consultant cannot see the Holiday field in a client payroll run.",
    );
    await user.click(
      screen.getByRole("radio", { name: /Clarification or guidance/i }),
    );
    await user.type(
      screen.getByLabelText(/Known evidence/i),
      "Administrators can see it",
    );
    await user.click(
      screen.getByRole("button", { name: "Open private draft" }),
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Payroll holiday configuration",
        intent: "clarification",
        evidenceNotes: ["Administrators can see it"],
      }),
    );
    expect(push).toHaveBeenCalledWith(
      "/app/cases/7fc3b3bd-9361-43f0-87d2-8b7d96e5a0cc",
    );
  });

  it("shows versioned assessments and keeps publishing as a separate action", async () => {
    const user = userEvent.setup();
    const draftCase = operationsCaseDetailSchema.parse({
      ...operationsCaseFixture,
      publicationState: "draft",
      publishedAt: null,
      assignee: null,
    });
    vi.spyOn(browserApi, "getCase").mockResolvedValue(draftCase);
    vi.spyOn(browserApi, "listWorkspaceMembers").mockResolvedValue(
      workspaceMemberListSchema.parse(workspaceMembersFixture),
    );
    vi.spyOn(browserApi, "executionOptions").mockResolvedValue(
      executionOptionsSchema.parse(executionOptionsFixture),
    );
    const publish = vi.spyOn(browserApi, "publishCase").mockResolvedValue({
      ...draftCase,
      publicationState: "published",
    });

    render(
      <QueryProvider>
        <CaseDetail caseId={draftCase.id} />
      </QueryProvider>,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Test the case against the evidence",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assessment 1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evidence before publication" })).toBeInTheDocument();
    expect(screen.getByText(/Advisory 1 reviewed and applied/i)).toBeInTheDocument();
    expect(
      screen.getByText(/AI results do not control publication/i),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: "Publish unassigned" }),
    );
    expect(publish).toHaveBeenCalledWith(draftCase.id, {
      assigneeId: null,
      assessmentId: draftCase.assessments[0].id,
    });
  });

  it("posts an attributed delivery update from a published case", async () => {
    const user = userEvent.setup();
    const publishedCase = operationsCaseDetailSchema.parse(operationsCaseFixture);
    vi.spyOn(browserApi, "getCase").mockResolvedValue(publishedCase);
    vi.spyOn(browserApi, "listWorkspaceMembers").mockResolvedValue(
      workspaceMemberListSchema.parse(workspaceMembersFixture),
    );
    vi.spyOn(browserApi, "executionOptions").mockResolvedValue(
      executionOptionsSchema.parse(executionOptionsFixture),
    );
    const createUpdate = vi.spyOn(browserApi, "createCaseUpdate").mockResolvedValue({
      id: "fef037b8-52cf-4f84-b12d-26a9fd65baa2",
      type: "progress",
      body: "Verified the worker queue and captured the next action.",
      author: null,
      taskId: null,
      externalLinks: [],
    verificationResult: "",
    mentionedMembers: [],
    attachments: [],
      createdAt: "2026-08-25T01:00:00Z",
    });

    render(
      <QueryProvider>
        <CaseDetail caseId={publishedCase.id} />
      </QueryProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Move the case forward" })).toBeInTheDocument();
    await user.type(
      screen.getByPlaceholderText(/What changed, what remains/i),
      "Verified the worker queue and captured the next action.",
    );
    await user.click(screen.getByRole("button", { name: "Post update" }));
    expect(createUpdate).toHaveBeenCalledWith(
      publishedCase.id,
      expect.objectContaining({
        type: "progress",
        body: "Verified the worker queue and captured the next action.",
      }),
    );
  });
});
