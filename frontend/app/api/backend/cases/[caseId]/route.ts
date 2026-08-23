import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateCaseInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface CaseRouteProps {
  params: Promise<{ caseId: string }>;
}

export async function GET(_request: Request, { params }: CaseRouteProps) {
  try {
    const [{ caseId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    return Response.json(await djangoApi.getCase(accessToken, caseId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PATCH(request: Request, { params }: CaseRouteProps) {
  try {
    const [{ caseId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    const input = updateCaseInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Review the case state, disposition, confidence, and resolution.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(await djangoApi.updateCase(accessToken, caseId, input.data));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
