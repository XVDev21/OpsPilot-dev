import "server-only";

import { withAuth } from "@workos-inc/authkit-nextjs";
import { ApiError } from "@/lib/api/errors";

export async function requireAccessToken() {
  const { accessToken } = await withAuth();
  if (!accessToken) {
    throw new ApiError({
      code: "AUTH_REQUIRED",
      message: "Sign in again to continue with Live Mode.",
      retryable: false,
    }, 401);
  }
  return accessToken;
}
