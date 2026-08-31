import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryProvider } from "@/components/providers/query-provider";
import { NotificationsPage } from "@/features/notifications/notifications-page";
import { NotificationPreferencesPanel } from "@/features/settings/notification-preferences-panel";
import { browserApi } from "@/lib/api/browser-client";
import { notificationListSchema, notificationPreferencesSchema } from "@/lib/api/schemas";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const inbox = notificationListSchema.parse({
  unreadCount: 1,
  items: [
    {
      id: "f2f0ffda-d252-4d14-b4d7-1de78e76a730",
      kind: "blocker",
      title: "OPS-0042 needs attention",
      summary: "Mina recorded a blocker.",
      caseId: "a3bdd720-1036-46cf-a261-cbfe3b079ecd",
      caseKey: "OPS-0042",
      caseTitle: "Payroll export fails",
      actionPath: "/app/cases/a3bdd720-1036-46cf-a261-cbfe3b079ecd?source=notification",
      readAt: null,
      createdAt: "2026-08-26T01:00:00Z",
    },
  ],
});

const preferences = notificationPreferencesSchema.parse({
  emailEnabled: true,
  eventOverrides: {
    assignment: null,
    blocker: null,
    mention: null,
    resolution: null,
    verification: null,
    dueDate: null,
  },
  effectiveEvents: {
    assignment: true,
    blocker: true,
    mention: true,
    resolution: true,
    verification: true,
    dueDate: true,
  },
  workspaceDefaults: {
    emailEnabled: true,
    assignment: true,
    blocker: true,
    mention: true,
    resolution: true,
    verification: true,
    dueDate: true,
  },
  canManageWorkspaceDefaults: true,
  providerConfigured: false,
  sender: "OpsPilot <onboarding@resend.dev>",
});

afterEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
});

describe("notification delivery UI", () => {
  it("shows high-signal inbox items and opens their case", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "listNotifications").mockResolvedValue(inbox);
    const read = vi.spyOn(browserApi, "markNotificationRead").mockResolvedValue({
      ...inbox.items[0],
      readAt: "2026-08-26T01:02:00Z",
    });
    vi.spyOn(browserApi, "markAllNotificationsRead").mockResolvedValue({ updated: 1 });
    render(<QueryProvider><NotificationsPage /></QueryProvider>);

    expect(await screen.findByRole("heading", { name: "Signals worth acting on" })).toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: /OPS-0042 needs attention/i }));
    expect(read).toHaveBeenCalledWith(inbox.items[0].id);
    expect(push).toHaveBeenCalledWith(inbox.items[0].actionPath);
  });

  it("keeps email default-on while allowing a personal opt-out", async () => {
    const user = userEvent.setup();
    vi.spyOn(browserApi, "notificationPreferences").mockResolvedValue(preferences);
    const save = vi.spyOn(browserApi, "updateNotificationPreferences").mockResolvedValue({
      ...preferences,
      emailEnabled: false,
    });
    render(<QueryProvider><NotificationPreferencesPanel /></QueryProvider>);

    expect(await screen.findByText("Email provider pending")).toBeInTheDocument();
    await user.click(await screen.findByRole("switch", { name: "Email delivery" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ emailEnabled: false }));
    expect(screen.getByText(/In-app notifications work now/i)).toBeInTheDocument();
  });
});
