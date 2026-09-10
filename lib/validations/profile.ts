export const BIO_MAX_LENGTH = 250;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

const USERNAME_RE = /^[a-z0-9_]+$/;

export type ProfileFormValues = {
  username: string;
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
  if (!username) {
    return "Username is required.";
  }
  if (!USERNAME_RE.test(username)) {
    return "Username must be lowercase letters, numbers, and underscores only (no spaces).";
  }
  if (
    username.length < USERNAME_MIN_LENGTH ||
    username.length > USERNAME_MAX_LENGTH
  ) {
    return `Username must be ${USERNAME_MIN_LENGTH}–${USERNAME_MAX_LENGTH} characters.`;
  }

  const bio = values.bio.trim();
  if (bio.length > BIO_MAX_LENGTH) {
    return `Bio must be ${BIO_MAX_LENGTH} characters or fewer.`;
  }

  return null;
}
