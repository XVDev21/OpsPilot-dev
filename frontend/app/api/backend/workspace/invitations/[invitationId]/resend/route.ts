import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function POST(
  _request: Request,
  context: { params: Promise<{ invitationId: string }> },
) {
  try {
    const { invitationId } = await context.params;
    return Response.json(
      await djangoApi.resendWorkspaceInvitation(await requireAccessToken(), invitationId),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
