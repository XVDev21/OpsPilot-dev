import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import executionOptionsFixture from "../../contracts/v1/execution-options.json";
import providerCredentialsFixture from "../../contracts/v1/provider-credentials.json";
import { QueryProvider } from "@/components/providers/query-provider";
import { ProviderCredentialsPanel } from "@/features/settings/provider-credentials-panel";
import { browserApi } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/errors";
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
        displayName: null,
        baseUrl: null,
        awsRegion: null,
        modelFast: null,
        modelBalanced: null,
        modelHigh: null,
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
    await user.click(qwen.getByRole("button", { name: "Connect provider" }));
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

  it("keeps every provider connection field available when authenticated status checks fail", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "listProviderCredentials").mockRejectedValue(
      new ApiError({
        code: "INVALID_TOKEN",
        message: "The access token is invalid or expired.",
        requestId: "676fcc63-3db7-4b35-954c-469225a2b806",
        retryable: false,
      }, 401),
    );
    vi.spyOn(browserApi, "executionOptions").mockRejectedValue(
      new ApiError({
        code: "INVALID_TOKEN",
        message: "The access token is invalid or expired.",
        retryable: false,
      }, 401),
    );

    render(
      <QueryProvider>
        <ProviderCredentialsPanel />
      </QueryProvider>,
    );

    expect(await screen.findByText("Live session needs attention")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Gemini" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OpenAI · Personal key" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qwen" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Amazon Bedrock" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "OpenAI-compatible" })).toBeInTheDocument();
    expect(screen.getAllByText("Status unavailable")).toHaveLength(5);

    const geminiCard = screen.getByRole("heading", { name: "Gemini" }).closest("article");
    expect(geminiCard).not.toBeNull();
    const gemini = within(geminiCard as HTMLElement);
    await user.click(gemini.getByRole("button", { name: "Connect provider" }));

    expect(gemini.getByLabelText("API key")).toBeInTheDocument();
    expect(gemini.getByRole("button", { name: "Save encrypted key" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Refresh sign-in" })).toHaveAttribute("target", "_blank");
  });
});
