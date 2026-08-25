import type { Metadata } from "next";
import { TeamDirectory } from "@/features/team/team-directory";

export const metadata: Metadata = {
  title: "Team",
  description: "Manage workspace access, real collaborators, sample profiles, and operational workload.",
};

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <TeamDirectory />
    </div>
  );
}
