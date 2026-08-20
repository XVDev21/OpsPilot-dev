export const sampleTeamMembers = [
  {
    id: "sample-amelia-cruz",
    name: "Amelia Cruz",
    email: "amelia.cruz@example.invalid",
    initials: "AC",
    role: "Operations lead",
    discipline: "Operations",
    focus: "Owns intake quality, meeting follow-through, and delivery visibility.",
    availability: "Available",
    workflowFit: ["Meeting follow-up", "Status coordination"],
    tone: "indigo",
  },
  {
    id: "sample-kai-mercer",
    name: "Kai Mercer",
    email: "kai.mercer@example.invalid",
    initials: "KM",
    role: "Support operations",
    discipline: "Operations",
    focus: "Checks configuration, permissions, and reproducible user-side conditions before escalation.",
    availability: "Available",
    workflowFit: ["Issue intake", "Settings review"],
    tone: "cyan",
  },
  {
    id: "sample-theo-bennett",
    name: "Theo Bennett",
    email: "theo.bennett@example.invalid",
    initials: "TB",
    role: "Development consultant",
    discipline: "Engineering",
    focus: "Turns validated symptoms into a bounded technical investigation and implementation brief.",
    availability: "Reviewing",
    workflowFit: ["Technical triage", "Scope review"],
    tone: "amber",
  },
  {
    id: "sample-mina-park",
    name: "Mina Park",
    email: "mina.park@example.invalid",
    initials: "MP",
    role: "Software engineer",
    discipline: "Engineering",
    focus: "Owns code changes after the issue has enough evidence and an agreed reproduction path.",
    availability: "Focused",
    workflowFit: ["Bug fixing", "Work updates"],
    tone: "indigo",
  },
  {
    id: "sample-rafael-silva",
    name: "Rafael Silva",
    email: "rafael.silva@example.invalid",
    initials: "RS",
    role: "Quality engineer",
    discipline: "Quality",
    focus: "Builds minimal reproductions, verifies fixes, and records confidence-changing evidence.",
    availability: "Available",
    workflowFit: ["Reproduction", "Release verification"],
    tone: "cyan",
  },
] as const;

export type SampleTeamMember = (typeof sampleTeamMembers)[number];
export type SampleTeamMemberId = SampleTeamMember["id"];

export function getSampleTeamMember(id: string | null | undefined) {
  return sampleTeamMembers.find((member) => member.id === id) ?? null;
}
