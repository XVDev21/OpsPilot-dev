import { describe, expect, it } from "vitest";
import { getSampleTeamMember, sampleTeamMembers } from "@/lib/collaboration/sample-team";

describe("sample collaboration team", () => {
  it("uses unique fictional identities that cannot receive real email", () => {
    expect(new Set(sampleTeamMembers.map((member) => member.id)).size).toBe(sampleTeamMembers.length);
    expect(sampleTeamMembers.every((member) => member.email.endsWith("@example.invalid"))).toBe(true);
  });

  it("covers operations, engineering, and quality handoffs", () => {
    expect(new Set(sampleTeamMembers.map((member) => member.discipline))).toEqual(
      new Set(["Operations", "Engineering", "Quality"]),
    );
    expect(getSampleTeamMember("sample-mina-park")?.role).toBe("Software engineer");
    expect(getSampleTeamMember("missing")).toBeNull();
  });
});
