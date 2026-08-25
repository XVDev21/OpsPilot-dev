import { djangoApi } from "@/lib/api/client";
import { apiErrorResponse } from "@/lib/api/errors";
import { requireAccessToken } from "@/lib/api/route-auth";

export async function GET() {
  try {
    return Response.json(await djangoApi.listWorkspaceInvitations(await requireAccessToken()));
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = (await request.json()) as {
      email: string;
      accessRole: "operator" | "contributor" | "viewer";
      targetMemberId?: string | null;
    };
    return Response.json(
      await djangoApi.inviteWorkspaceMember(await requireAccessToken(), input),
      { status: 201 },
    );
  } catch (error) {
    return apiErrorResponse(error);
  }
}
