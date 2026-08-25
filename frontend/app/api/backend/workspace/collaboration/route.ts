import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string | null };
    return Response.json(
      await djangoApi.activateWorkspaceCollaboration(
        await requireAccessToken(),
        body.name || undefined,
      ),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
