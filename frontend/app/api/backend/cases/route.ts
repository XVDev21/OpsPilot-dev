import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createCaseInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET(request: Request) {
  try {
    const accessToken = await requireAccessToken();
    const source = new URL(request.url).searchParams;
    const allowed = new URLSearchParams();
    for (const key of [
      "page",
      "pageSize",
      "status",
      "disposition",
      "intent",
      "publicationState",
      "assigneeId",
      "search",
    ]) {
      const value = source.get(key);
      if (value) allowed.set(key, value);
    }
    return Response.json(
      await djangoApi.listCases(accessToken, allowed.size ? `?${allowed}` : ""),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireAccessToken();
    const input = createCaseInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message:
            "Add a clear case title and enough context for another person to act.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(await djangoApi.createCase(accessToken, input.data), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
