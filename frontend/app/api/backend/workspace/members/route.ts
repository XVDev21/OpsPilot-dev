import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET() {
  try {
    const accessToken = await requireAccessToken();
    return Response.json(await djangoApi.listWorkspaceMembers(accessToken));
  } catch (error) {
    return apiErrorResponse(error);
  }
}
