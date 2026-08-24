import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/backend/cases/[caseId]/evidence/images/route";
import { djangoApi } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

vi.mock("@/lib/api/client", () => ({
  djangoApi: { uploadImageEvidence: vi.fn() },
}));
vi.mock("@/lib/api/route-auth", () => ({ requireAccessToken: vi.fn() }));

const routeProps = {
  params: Promise.resolve({ caseId: "7fc3b3bd-9361-43f0-87d2-8b7d96e5a0cc" }),
};

afterEach(() => {
  vi.resetAllMocks();
});

describe("case evidence image BFF route", () => {
  it("authenticates before parsing an untrusted multipart body", async () => {
    vi.mocked(requireAccessToken).mockRejectedValue(
      new ApiError(
        { code: "AUTH_REQUIRED", message: "Sign in required.", retryable: false },
        401,
      ),
    );
    const formData = vi.fn();
    const request = {
      headers: new Headers(),
      formData,
    } as unknown as Request;

    const response = await POST(request, routeProps);

    expect(response.status).toBe(401);
    expect(formData).not.toHaveBeenCalled();
  });

  it("rejects an oversized declared body before multipart parsing", async () => {
    vi.mocked(requireAccessToken).mockResolvedValue("access-token");
    const formData = vi.fn();
    const request = {
      headers: new Headers({ "content-length": String(10 * 1024 * 1024) }),
      formData,
    } as unknown as Request;

    const response = await POST(request, routeProps);

    expect(response.status).toBe(413);
    expect(formData).not.toHaveBeenCalled();
  });

  it("rejects a parsed file above the evidence byte ceiling", async () => {
    vi.mocked(requireAccessToken).mockResolvedValue("access-token");
    const source = new FormData();
    source.set(
      "file",
      new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );
    const request = {
      headers: new Headers(),
      formData: vi.fn().mockResolvedValue(source),
    } as unknown as Request;

    const response = await POST(request, routeProps);

    expect(response.status).toBe(413);
    expect(djangoApi.uploadImageEvidence).not.toHaveBeenCalled();
  });
});
