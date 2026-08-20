import type { Metadata } from "next";
import { TeamDirectory } from "@/features/team/team-directory";

export const metadata: Metadata = {
  title: "Team",
  description: "Review the sample operations pod used for workflow routing and ownership demos.",
};

export default function TeamPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <TeamDirectory />
    </div>
  );
}
