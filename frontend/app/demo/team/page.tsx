import type { Metadata } from "next";
import { TeamDirectory } from "@/features/team/team-directory";

export const metadata: Metadata = {
  title: "Sample operations team",
  description: "Meet the fictional delivery pod used by OpsPilot Demo Mode.",
};

export default function DemoTeamPage() {
  return (
    <div className="mx-auto max-w-[86rem]">
      <TeamDirectory workflowHref="/demo/workflows" />
    </div>
  );
}
