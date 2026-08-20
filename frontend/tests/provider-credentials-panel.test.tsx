import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import executionOptionsFixture from "../../contracts/v1/execution-options.json";
import providerCredentialsFixture from "../../contracts/v1/provider-credentials.json";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProviderCredentialsPanel } from "@/features/settings/provider-credentials-panel";
import { browserApi } from "@/lib/api/browser-client";
import {
  executionOptionsSchema,
  providerCredentialListSchema,
  providerCredentialSummarySchema,
} from "@/lib/api/schemas";

afterEach(() => vi.restoreAllMocks());

describe("provider credential vault", () => {
  it("shows masked status and saves a Qwen key without persisting it in the browser", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "listProviderCredentials").mockResolvedValue(
      providerCredentialListSchema.parse(providerCredentialsFixture),
    );
    vi.spyOn(browserApi, "executionOptions").mockResolvedValue(
      executionOptionsSchema.parse(executionOptionsFixture),
    );
    const saveCredential = vi.spyOn(browserApi, "saveProviderCredential").mockResolvedValue(
      providerCredentialSummarySchema.parse({
        provider: "qwen",
        configured: true,
        keyFingerprint: "1a2b3c4d5e6f",
        endpointRegion: "singapore",
        workspaceId: "ws-opspilot-01",
        updatedAt: "2026-08-20T09:00:00Z",
      }),
    );

    render(
      <QueryProvider>
        <ProviderCredentialsPanel />
      </QueryProvider>,
    );

    expect(await screen.findByText("Encrypted key fingerprint 63d0c8eb9a10.")).toBeInTheDocument();
    const qwenCard = screen.getByRole("heading", { name: "Qwen" }).closest("article");
    expect(qwenCard).not.toBeNull();
    const qwen = within(qwenCard as HTMLElement);
    await user.click(qwen.getByRole("button", { name: "Add personal key" }));
    await user.type(qwen.getByLabelText("API key"), "qwen-personal-key-that-is-long-enough");
    await user.type(qwen.getByLabelText("Workspace ID"), "ws-opspilot-01");
    await user.click(qwen.getByRole("button", { name: "Save encrypted key" }));

    expect(saveCredential).toHaveBeenCalledWith("qwen", {
      apiKey: "qwen-personal-key-that-is-long-enough",
      endpointRegion: "singapore",
      workspaceId: "ws-opspilot-01",
    });
    expect(window.localStorage.length).toBe(0);
  });
});
