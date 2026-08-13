export interface AppUser {
  id: string;
  email: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
  avatarUrl: string | null;
  initials: string;
}

interface WorkOSUserShape {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  profilePictureUrl?: string | null;
}

export function toAppUser(user: WorkOSUserShape): AppUser {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;
  const initials =
    [user.firstName, user.lastName]
      .filter(Boolean)
      .map((part) => part?.charAt(0))
      .join("") || user.email.charAt(0);

  return {
    id: user.id,
    email: user.email,
    displayName,
    firstName: user.firstName ?? null,
    lastName: user.lastName ?? null,
    avatarUrl: user.profilePictureUrl ?? null,
    initials: initials.toUpperCase(),
  };
}
