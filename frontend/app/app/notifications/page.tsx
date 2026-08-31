import type { Metadata } from "next";
import { NotificationsPage } from "@/features/notifications/notifications-page";

export const metadata: Metadata = {
  title: "Notifications",
  description: "Review assignments and high-signal Operations Case activity.",
};

export default function NotificationInboxPage() {
  return <NotificationsPage />;
}
