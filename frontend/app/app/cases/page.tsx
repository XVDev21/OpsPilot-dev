import type { Metadata } from "next";
import { CasesList } from "@/features/cases/cases-list";

export const metadata: Metadata = {
  title: "Operations cases",
  description: "Open, assign, classify, and resolve durable operations cases.",
};

export default function CasesPage() {
  return <div className="mx-auto max-w-[96rem]"><CasesList /></div>;
}
