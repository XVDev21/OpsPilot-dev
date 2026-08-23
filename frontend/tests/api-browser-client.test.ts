import { afterEach, describe, expect, it, vi } from "vitest";
import { browserApi } from "@/lib/api/browser-client";
import workflowRunFixture from "../../contracts/v1/workflow-run.json";
import providerCredentialsFixture from "../../contracts/v1/provider-credentials.json";

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

  it("sends only validated provider and intelligence identifiers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => workflowRunFixture,
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    await browserApi.createRun(
      "bug-triage",
      { title: "CSV export stalls" },
      { provider: "gemini", intelligence: "fast" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/workflows/bug-triage/runs",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          input: { title: "CSV export stalls" },
          options: { provider: "gemini", intelligence: "fast" },
        }),
      }),
    );
  });

  it("runs model selection through the case assessment endpoint", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      headers: new Headers(),
      json: async () => ({ ...workflowRunFixture, case_id: "7fc3b3bd-9361-43f0-87d2-8b7d96e5a0cc" }),
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    await browserApi.createCaseAssessment(
      "7fc3b3bd-9361-43f0-87d2-8b7d96e5a0cc",
      { provider: "gemini", intelligence: "balanced" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/cases/7fc3b3bd-9361-43f0-87d2-8b7d96e5a0cc/assessments",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ provider: "gemini", intelligence: "balanced" }),
      }),
    );
  });

  it("sends a personal provider key only to the same-origin credential endpoint", async () => {
    const savedCredential = providerCredentialsFixture.items[1];
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => savedCredential,
    } satisfies Partial<Response>);
    vi.stubGlobal("fetch", fetchMock);

    await browserApi.saveProviderCredential("openai", {
      apiKey: "sk-personal-openai-key-that-is-long-enough",
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/backend/provider-credentials/openai",
      expect.objectContaining({
        method: "PUT",
        body: JSON.stringify({ apiKey: "sk-personal-openai-key-that-is-long-enough" }),
      }),
    );
  });
});
