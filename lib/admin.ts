/**
 * Admin allowlist helpers for /admin routes and API.
 *
 * Configure via env (comma-separated):
 *   ADMIN_EMAILS=you@example.com,ops@example.com
 *   # or single: ADMIN_EMAIL=you@example.com
 */
export function getAdminEmails(): string[] {
  const raw =
    process.env.ADMIN_EMAILS ||
    process.env.ADMIN_EMAIL ||
    process.env.NEXT_PUBLIC_ADMIN_EMAILS ||
    "";

  return raw
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allowed = getAdminEmails();
  if (allowed.length === 0) return false;
  return allowed.includes(email.trim().toLowerCase());
}

export const IMAGE_REVIEW_APPROVED_MESSAGE =
  "Thread approved and published to the public feed.";

export const IMAGE_REVIEW_REJECTED_MESSAGE =
  "Thread rejected and removed from the review queue.";
