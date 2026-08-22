import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { localConnectorPairingInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function POST(request: Request) {
  try {
    const accessToken = await requireAccessToken();
    const input = localConnectorPairingInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Review the connector name and model mappings.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(await djangoApi.createLocalConnectorPairing(accessToken, input.data), {
      status: 201,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
