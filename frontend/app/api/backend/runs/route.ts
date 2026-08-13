import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET() {
  try {
    const accessToken = await requireAccessToken();
    const response = await djangoApi.listRuns(accessToken);
    return Response.json(Array.isArray(response) ? { items: response } : response);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
