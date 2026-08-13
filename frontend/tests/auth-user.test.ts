import { describe, expect, it } from "vitest";
import { toAppUser } from "@/lib/auth/types";

describe("WorkOS user presentation", () => {
  it("uses the profile name, avatar, and initials when available", () => {
    expect(
      toAppUser({
        id: "user_123",
        email: "alex@example.com",
        firstName: "Alex",
        lastName: "Rivera",
        profilePictureUrl: "https://images.workoscdn.com/avatar.png",
      }),
    ).toEqual({
      id: "user_123",
      email: "alex@example.com",
      displayName: "Alex Rivera",
      firstName: "Alex",
      lastName: "Rivera",
      avatarUrl: "https://images.workoscdn.com/avatar.png",
      initials: "AR",
    });
  });

  it("falls back to email identity when names are absent", () => {
    expect(toAppUser({ id: "user_456", email: "ops@example.com" })).toMatchObject({
      displayName: "ops@example.com",
      initials: "O",
      avatarUrl: null,
    });
  });
});
