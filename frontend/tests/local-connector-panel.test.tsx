import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/components/providers/query-provider";
import { LocalConnectorPanel } from "@/features/settings/local-connector-panel";
import { browserApi } from "@/lib/api/browser-client";

afterEach(() => vi.restoreAllMocks());

describe("local model connector", () => {
  it("creates a one-time outbound pairing command", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "getLocalConnector").mockResolvedValue({ connector: null });
    vi.spyOn(browserApi, "createLocalConnectorPairing").mockResolvedValue({
      connector: {
        id: "8ee35873-df4b-4011-9d62-0a85a17d6cc4",
        name: "Development workstation",
        paired: false,
        online: false,
        modelFast: "qwen2.5:3b",
        modelBalanced: "qwen2.5:7b",
        modelHigh: "qwen2.5:14b",
        pairedAt: null,
        lastSeenAt: null,
        updatedAt: "2026-08-22T01:00:00Z",
      },
      pairingCode: "one-time-pairing-code-that-is-long-enough",
      expiresAt: "2026-08-22T01:10:00Z",
    });

    render(<QueryProvider><LocalConnectorPanel /></QueryProvider>);
    await user.click(await screen.findByRole("button", { name: "Generate one-time pairing command" }));

    expect(await screen.findByText("Run this command within 10 minutes")).toBeInTheDocument();
    expect(screen.getByText(/--connector-id 8ee35873/)).toBeInTheDocument();
    expect(screen.getByText(/--base-url http:\/\/127\.0\.0\.1:11434\/v1/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy command" })).toBeInTheDocument();
  });
});
