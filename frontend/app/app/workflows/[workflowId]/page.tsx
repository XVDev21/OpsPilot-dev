import { redirect } from "next/navigation";

interface LegacyWorkflowPageProps {
  searchParams: Promise<{ case?: string }>;
}

export default async function RetiredWorkflowPage({ searchParams }: LegacyWorkflowPageProps) {
  const { case: caseId } = await searchParams;
  redirect(caseId ? `/app/cases/${encodeURIComponent(caseId)}` : "/app/cases");
}
