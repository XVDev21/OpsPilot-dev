import { authkitProxy } from "@workos-inc/authkit-nextjs";

export default authkitProxy({
  middlewareAuth: {
    enabled: true,
    unauthenticatedPaths: [
      "/sign-in",
      "/sign-up",
      "/auth/callback",
      "/api/backend/:path*",
    ],
  },
  signUpPaths: ["/sign-up"],
});

export const config = {
  matcher: ["/app/:path*", "/api/backend/:path*", "/sign-in", "/sign-up", "/auth/callback"],
};
