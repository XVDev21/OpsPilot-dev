import { getSignInUrl } from "@workos-inc/authkit-nextjs";

export async function GET() {
  const signInUrl = await getSignInUrl();
  return Response.redirect(signInUrl);
}
