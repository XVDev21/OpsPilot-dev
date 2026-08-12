import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { WorkflowRunner } from "@/features/workflows/workflow-runner";

describe("Demo Mode workflow runner", () => {
  it.each([
    ["bug-triage", "Run demo triage", "Human review required"],
    ["meeting-actions", "Run demo extraction", "Action items"],
    ["status-update", "Run demo update", "Copy-ready update"],
  ] as const)("loads sample input and renders the %s result", async (workflowId, action, expected) => {
    const user = userEvent.setup();
    render(<WorkflowRunner workflowId={workflowId} />);
    await user.click(screen.getByRole("button", { name: "Load sample" }));
    await user.click(screen.getByRole("button", { name: action }));
    expect(await screen.findByText(expected)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy result" })).toBeInTheDocument();
  });

  it("copies a generated result", async () => {
    const user = userEvent.setup();
    render(<WorkflowRunner workflowId="status-update" />);
    await user.click(screen.getByRole("button", { name: "Load sample" }));
    await user.click(screen.getByRole("button", { name: "Run demo update" }));
    await user.click(await screen.findByRole("button", { name: "Copy result" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeInTheDocument();
  });
});
