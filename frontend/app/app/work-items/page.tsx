import { redirect } from "next/navigation";

export default async function WorkItemsPage({ searchParams }: { searchParams: Promise<{ handoff?: string; case?: string }> }) {
  const query = await searchParams;
  if (query.case) redirect(`/app/cases/${query.case}`);
  redirect("/app/work-status");
}
