import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createTextEvidenceInputSchema } from "@/lib/api/schemas";
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
    const input = createTextEvidenceInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message:
            "Evidence notes must contain between 3 and 3,000 characters.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(
      await djangoApi.addTextEvidence(accessToken, caseId, input.data.text),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
