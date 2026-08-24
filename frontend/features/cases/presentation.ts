import type {
  CaseDisposition,
  CaseIntent,
  CasePublicationState,
  CaseStatus,
} from "@/lib/api/types";

export const caseStatusLabels: Record<CaseStatus, string> = {
  new: "New",
  triaging: "Triaging",
  "needs-information": "Needs information",
  "action-required": "Action required",
  "in-progress": "In progress",
  verification: "Verification",
  monitoring: "Monitoring",
  resolved: "Resolved",
  closed: "Closed",
};

export const caseDispositionLabels: Record<CaseDisposition, string> = {
  unclassified: "Unclassified",
  "product-defect": "Product defect",
  "configuration-change": "Configuration change",
  "process-guidance": "Process guidance",
  "external-dependency": "External dependency",
  duplicate: "Duplicate",
  "needs-more-evidence": "Needs more evidence",
};

export const caseStatuses = Object.keys(caseStatusLabels) as CaseStatus[];
export const caseDispositions = Object.keys(caseDispositionLabels) as CaseDisposition[];

export const caseIntentLabels: Record<CaseIntent, string> = {
  issue: "Issue investigation",
  clarification: "Clarification or guidance",
  enhancement: "Additional development",
};

export const casePublicationLabels: Record<CasePublicationState, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

export const allowedCaseTransitions: Record<CaseStatus, CaseStatus[]> = {
  new: ["triaging", "needs-information", "action-required", "resolved", "closed"],
  triaging: ["needs-information", "action-required", "in-progress", "resolved", "closed"],
  "needs-information": ["triaging", "action-required", "closed"],
  "action-required": ["needs-information", "in-progress", "resolved", "closed"],
  "in-progress": ["needs-information", "verification", "monitoring", "resolved", "closed"],
  verification: ["in-progress", "needs-information", "monitoring", "resolved", "closed"],
  monitoring: ["in-progress", "verification", "resolved", "closed"],
  resolved: ["monitoring", "verification", "triaging", "closed"],
  closed: ["triaging"],
};

export const dateFormatter = new Intl.DateTimeFormat("en", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function formatCaseDate(value: string | null) {
  if (!value) return "No due date";
  return dateFormatter.format(new Date(value));
}

export function eventLabel(type: string) {
  return type.replaceAll("-", " ").replace(/^./, (letter) => letter.toUpperCase());
}
