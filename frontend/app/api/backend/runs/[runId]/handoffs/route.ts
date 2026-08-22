import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { createHandoffInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

interface RunHandoffRouteProps {
  params: Promise<{ runId: string }>;
}

export async function POST(request: Request, { params }: RunHandoffRouteProps) {
  try {
    const [{ runId }, accessToken] = await Promise.all([params, requireAccessToken()]);
    const input = createHandoffInputSchema.safeParse(await request.json().catch(() => null));
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Choose a supported workflow handoff.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(await djangoApi.createHandoff(accessToken, runId, input.data.target), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
