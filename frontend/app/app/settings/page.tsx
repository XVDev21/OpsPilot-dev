import type { Metadata } from "next";
import { withAuth } from "@workos-inc/authkit-nextjs";
import { SettingsPanel } from "@/features/settings/settings-panel";
import { toAppUser } from "@/lib/auth/types";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your OpsPilot profile, appearance, and workflow execution mode.",
};

export default async function SettingsPage() {
  const { user } = await withAuth({ ensureSignedIn: true });
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Settings</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-muted">Account truth, interface preferences, and execution behavior in one place.</p>
      <div className="mt-8"><SettingsPanel user={toAppUser(user)} /></div>
    </div>
  );
}
