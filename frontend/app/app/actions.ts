"use server";

import { signOut, switchToOrganization } from "@workos-inc/authkit-nextjs";

export async function signOutAction() {
  await signOut();
}

export async function switchWorkspaceAction(formData: FormData) {
  const organizationId = String(formData.get("organizationId") || "");
  const requestedReturnTo = String(formData.get("returnTo") || "/app");
  if (!/^org_[A-Za-z0-9]+$/.test(organizationId)) return;
  const returnTo = requestedReturnTo.startsWith("/app") ? requestedReturnTo : "/app";
  await switchToOrganization(organizationId, { returnTo });
}
