import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memberId: string }> },
) {
  try {
    const { memberId } = await context.params;
    const input = (await request.json()) as {
      accessRole?: "operator" | "contributor" | "viewer";
      active?: boolean;
    };
    return Response.json(
      await djangoApi.updateWorkspaceMember(await requireAccessToken(), memberId, input),
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
