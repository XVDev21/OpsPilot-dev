import type { Metadata } from "next";
import { CaseDetail } from "@/features/cases/case-detail";

export const metadata: Metadata = {
  title: "Operations case",
  description: "Review case ownership, state, delivery work, and activity.",
};

export default async function OperationsCasePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <div className="mx-auto max-w-[96rem]"><CaseDetail caseId={caseId} /></div>;
}
