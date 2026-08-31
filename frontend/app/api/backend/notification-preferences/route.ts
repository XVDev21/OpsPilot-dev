import { djangoApi } from "@/lib/api/client";
import { ApiError, apiErrorResponse } from "@/lib/api/errors";
import { updateNotificationPreferencesInputSchema } from "@/lib/api/schemas";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET() {
  try {
    return Response.json(await djangoApi.notificationPreferences(await requireAccessToken()));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const input = updateNotificationPreferencesInputSchema.safeParse(
      await request.json().catch(() => null),
    );
    if (!input.success) {
      throw new ApiError(
        {
          code: "VALIDATION_ERROR",
          message: "Choose valid notification preferences.",
          retryable: false,
        },
        422,
      );
    }
    return Response.json(
      await djangoApi.updateNotificationPreferences(await requireAccessToken(), input.data),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
