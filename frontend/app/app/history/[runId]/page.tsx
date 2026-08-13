import type { Metadata } from "next";
import { HistoryDetail } from "@/features/history/history-detail";

export const metadata: Metadata = {
  title: "Run details",
  description: "Review an OpsPilot workflow input, result, and technical details.",
};

export default async function HistoryDetailPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  return <div className="mx-auto max-w-6xl"><HistoryDetail runId={runId} /></div>;
}
