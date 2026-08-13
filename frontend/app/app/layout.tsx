import { withAuth } from "@workos-inc/authkit-nextjs";
import { AuthKitProvider } from "@workos-inc/authkit-nextjs/components";
import { AppShell } from "@/components/layout/app-shell";
import { AppModeProvider } from "@/components/providers/app-mode-provider";
import { toAppUser } from "@/lib/auth/types";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const {
    user,
    sessionId,
    organizationId,
    role,
    roles,
    permissions,
    entitlements,
    featureFlags,
    impersonator,
  } = await withAuth({ ensureSignedIn: true });

  return (
    <AuthKitProvider
      initialAuth={{
        user,
        sessionId,
        organizationId,
        role,
        roles,
        permissions,
        entitlements,
        featureFlags,
        impersonator,
      }}
    >
      <AppModeProvider>
        <AppShell user={toAppUser(user)}>{children}</AppShell>
      </AppModeProvider>
    </AuthKitProvider>
  );
}
