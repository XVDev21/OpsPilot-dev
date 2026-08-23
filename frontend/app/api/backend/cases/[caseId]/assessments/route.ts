import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createAssessmentInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RouteProps {
  params: Promise<{ caseId: string }>;
}

export async function POST(request: Request, { params }: RouteProps) {
  try {
    const [{ caseId }, accessToken] = await Promise.all([
      params,
      requireAccessToken(),
    ]);
    const input = createAssessmentInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Choose a configured provider and intelligence level.",
          retryable: false,
        },
        422,
      );
    }
    const run = await djangoApi.createCaseAssessment(
      accessToken,
      caseId,
      input.data,
    );
    return Response.json(run, { status: run.status === "pending" ? 202 : 201 });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
