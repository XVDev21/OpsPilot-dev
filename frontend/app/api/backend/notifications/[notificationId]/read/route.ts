import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ notificationId: string }> },
) {
  try {
    const [{ notificationId }, accessToken] = await Promise.all([
      context.params,
      requireAccessToken(),
    ]);
    return Response.json(await djangoApi.markNotificationRead(accessToken, notificationId));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
