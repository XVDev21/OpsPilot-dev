import type { Metadata } from "next";
import { WorkStatusBoard } from "@/features/cases/work-status-board";

export const metadata: Metadata = {
  title: "Work Status",
  description: "Track published Operations Cases, ownership, deadlines, and verification.",
};

export default function WorkStatusPage() {
  return <div className="mx-auto max-w-[96rem]"><WorkStatusBoard /></div>;
}
