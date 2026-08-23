import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createWorkItemInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET(request: Request) {
  try {
    const accessToken = await requireAccessToken();
    const source = new URL(request.url).searchParams;
    const allowed = new URLSearchParams();
    for (const key of ["status", "assigneeId", "caseId"]) {
      const value = source.get(key);
      if (value) allowed.set(key, value);
    }
    const search = allowed.size ? `?${allowed}` : "";
    return Response.json(await djangoApi.listWorkItems(accessToken, search));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const accessToken = await requireAccessToken();
    const input = createWorkItemInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Review the work-item draft before creating it.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(await djangoApi.createWorkItem(accessToken, input.data), { status: 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
