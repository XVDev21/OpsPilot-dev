import { getSignUpUrl } from "@workos-inc/authkit-nextjs";

export async function GET() {
  const signUpUrl = await getSignUpUrl();
  return Response.redirect(signUpUrl);
}
