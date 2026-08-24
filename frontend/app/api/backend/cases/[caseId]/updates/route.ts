import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createCaseUpdateInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const [{ caseId }, accessToken, body] = await Promise.all([
      params,
      requireAccessToken(),
      request.json().catch(() => null),
    ]);
    const input = createCaseUpdateInputSchema.safeParse(body);
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Add a valid case update before posting it.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(
      await djangoApi.createCaseUpdate(accessToken, caseId, input.data),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
