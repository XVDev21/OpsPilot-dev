import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import workflowRunFixture from "../../contracts/v1/workflow-run.json";
import { AppModeProvider } from "@/components/providers/app-mode-provider";
import { QueryProvider } from "@/components/providers/query-provider";
import { ManagedWorkflowRunner } from "@/features/workflows/workflow-runner";
import { browserApi } from "@/lib/api/browser-client";
import { workflowRunSchema } from "@/lib/api/schemas";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));

afterEach(() => vi.restoreAllMocks());

describe("observable live execution", () => {
  it("shows a real in-flight provider phase before rendering the validated result", async () => {
    const user = userEvent.setup();
    let resolveRun: ((value: ReturnType<typeof workflowRunSchema.parse>) => void) | undefined;
    vi.spyOn(browserApi, "createRun").mockReturnValue(
      new Promise((resolve) => { resolveRun = resolve; }),
    );
    render(
      <AppModeProvider>
        <QueryProvider>
          <ManagedWorkflowRunner workflowId="bug-triage" />
        </QueryProvider>
      </AppModeProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Load advanced sample" }));
    await user.click(screen.getByRole("button", { name: "Run live triage" }));

    expect(await screen.findByText("Gemini is processing the workflow")).toBeInTheDocument();
    expect(screen.getByText("Provider generating").closest("li")).toHaveAttribute(
      "aria-current",
      "step",
    );
    resolveRun?.(workflowRunSchema.parse(workflowRunFixture));
    expect(await screen.findByText("Human review required")).toBeInTheDocument();
  });
});
