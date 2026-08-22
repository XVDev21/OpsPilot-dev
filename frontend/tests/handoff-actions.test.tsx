import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/components/providers/query-provider";
import { HandoffActions } from "@/features/workflows/handoff-actions";
import { browserApi } from "@/lib/api/browser-client";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe("bug triage handoffs", () => {
  it("creates an editable work-item draft and routes to review", async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(browserApi, "createHandoff").mockResolvedValue({
      id: "13dd407e-fdc8-4b31-969a-c8ece667a9ee",
      sourceRunId: "6544ba3d-0791-4ad4-a57b-7d3959aa2fbd",
      target: "work-item",
      status: "draft",
      draftInput: { title: "Investigate CSV export" },
      targetRunId: null,
      createdAt: "2026-08-22T01:00:00Z",
      convertedAt: null,
    });
    render(
      <QueryProvider>
        <HandoffActions
          sourceRunId="6544ba3d-0791-4ad4-a57b-7d3959aa2fbd"
          issueType="product-defect"
        />
      </QueryProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Create engineering work item" }));

    expect(create).toHaveBeenCalledWith(
      "6544ba3d-0791-4ad4-a57b-7d3959aa2fbd",
      "work-item",
    );
    expect(push).toHaveBeenCalledWith(
      "/app/work-items?handoff=13dd407e-fdc8-4b31-969a-c8ece667a9ee",
    );
  });
});
