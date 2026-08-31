import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as getPreferences, PUT as putPreferences } from "@/app/api/backend/notification-preferences/route";
import { PATCH as markRead } from "@/app/api/backend/notifications/[notificationId]/read/route";
import { POST as markAllRead } from "@/app/api/backend/notifications/read-all/route";
import { GET as getNotifications } from "@/app/api/backend/notifications/route";
import { djangoApi } from "@/lib/api/client";
import { requireAccessToken } from "@/lib/api/route-auth";

vi.mock("@/lib/api/client", () => ({
  djangoApi: {
    listNotifications: vi.fn(),
    markNotificationRead: vi.fn(),
    markAllNotificationsRead: vi.fn(),
    notificationPreferences: vi.fn(),
    updateNotificationPreferences: vi.fn(),
  },
}));
vi.mock("@/lib/api/route-auth", () => ({ requireAccessToken: vi.fn() }));

const preferences = {
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
};

afterEach(() => {
  vi.resetAllMocks();
});

describe("notification BFF routes", () => {
  it("authenticates, normalizes inbox filters, and proxies read mutations", async () => {
    vi.mocked(requireAccessToken).mockResolvedValue("access-token");
    vi.mocked(djangoApi.listNotifications).mockResolvedValue({ items: [], unreadCount: 0 });
    vi.mocked(djangoApi.markAllNotificationsRead).mockResolvedValue({ updated: 2 });
    const item = {
      id: "f2f0ffda-d252-4d14-b4d7-1de78e76a730",
      kind: "assignment" as const,
      title: "Assigned to OPS-0042",
      summary: "A teammate assigned this case to you.",
      caseId: "a3bdd720-1036-46cf-a261-cbfe3b079ecd",
      caseKey: "OPS-0042",
      caseTitle: "Payroll export fails",
      actionPath: "/app/cases/a3bdd720-1036-46cf-a261-cbfe3b079ecd?source=notification",
      readAt: null,
      createdAt: "2026-08-26T01:00:00Z",
    };
    vi.mocked(djangoApi.markNotificationRead).mockResolvedValue(item);

    const inboxResponse = await getNotifications(
      new Request("http://localhost/api/backend/notifications?unreadOnly=true&limit=500"),
    );
    expect(inboxResponse.status).toBe(200);
    expect(djangoApi.listNotifications).toHaveBeenCalledWith(
      "access-token",
      "?unreadOnly=true&limit=100",
    );

    const readResponse = await markRead(new Request("http://localhost"), {
      params: Promise.resolve({ notificationId: item.id }),
    });
    expect(readResponse.status).toBe(200);
    expect(djangoApi.markNotificationRead).toHaveBeenCalledWith("access-token", item.id);

    const allResponse = await markAllRead();
    expect(await allResponse.json()).toEqual({ updated: 2 });
  });

  it("loads and validates default-on notification preferences", async () => {
    vi.mocked(requireAccessToken).mockResolvedValue("access-token");
    vi.mocked(djangoApi.notificationPreferences).mockResolvedValue(preferences);
    vi.mocked(djangoApi.updateNotificationPreferences).mockResolvedValue({
      ...preferences,
      emailEnabled: false,
    });

    const getResponse = await getPreferences();
    expect(getResponse.status).toBe(200);
    expect(djangoApi.notificationPreferences).toHaveBeenCalledWith("access-token");

    const invalid = await putPreferences(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ emailEnabled: "sometimes" }),
      }),
    );
    expect(invalid.status).toBe(422);
    expect(djangoApi.updateNotificationPreferences).not.toHaveBeenCalled();

    const valid = await putPreferences(
      new Request("http://localhost", {
        method: "PUT",
        body: JSON.stringify({ emailEnabled: false }),
      }),
    );
    expect(valid.status).toBe(200);
    expect(djangoApi.updateNotificationPreferences).toHaveBeenCalledWith(
      "access-token",
      { emailEnabled: false },
    );
  });
});
