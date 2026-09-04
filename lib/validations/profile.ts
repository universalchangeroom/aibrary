export const BIO_MAX_LENGTH = 250;

const USERNAME_RE = /^[a-z0-9_]+$/;

export type ProfileFormValues = {
  username: string;
  display_name: string;
  bio: string;
};

export type UpdateProfileResult =
  | { success: true; profile: ProfileFormValues }
  | { success: false; error: string };

export function normalizeUsername(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed) return null;
  return trimmed;
}

export function validateProfileForm(values: ProfileFormValues): string | null {
  const username = normalizeUsername(values.username);
  if (username !== null && !USERNAME_RE.test(username)) {
    return "Username must be lowercase letters, numbers, and underscores only (no spaces).";
  }

  const bio = values.bio.trim();
  if (bio.length > BIO_MAX_LENGTH) {
    return `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}
