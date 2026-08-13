import type { Metadata } from "next";
import { HistoryList } from "@/features/history/history-list";

export const metadata: Metadata = {
  title: "Run history",
  description: "Review the workflow runs saved to your OpsPilot account.",
};

export default function HistoryPage() {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-balance text-3xl font-bold tracking-[-0.04em] text-foreground sm:text-4xl">Run history</h1>
      <p className="mt-3 max-w-2xl text-base leading-7 text-foreground-muted">Return to a structured result, inspect its input and technical context, or remove it from your account.</p>
      <div className="mt-8"><HistoryList /></div>
    </div>
  );
}
