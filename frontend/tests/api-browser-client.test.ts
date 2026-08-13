import { afterEach, describe, expect, it, vi } from "vitest";
import { browserApi } from "@/lib/api/browser-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("browser API client", () => {
  it("preserves backend request IDs and retry guidance", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        headers: new Headers({ "x-request-id": "req_123" }),
        json: async () => ({
          error: {
            code: "AI_RATE_LIMIT",
            message: "The provider is busy.",
            retryable: true,
          },
        }),
      } satisfies Partial<Response>),
    );

    await expect(browserApi.listRuns()).rejects.toMatchObject({
      code: "AI_RATE_LIMIT",
      message: "The provider is busy.",
      requestId: "req_123",
      retryable: true,
      status: 429,
    });
  });

  it("normalizes same-origin network failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await expect(browserApi.currentUser()).rejects.toMatchObject({
      code: "BACKEND_UNAVAILABLE",
      status: 503,
      retryable: true,
    });
  });
});
