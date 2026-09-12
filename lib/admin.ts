/**
 * Admin allowlist helpers — safe for Client Components.
 *
 * Configure via env (comma-separated):
 *   ADMIN_EMAILS=you@example.com,ops@example.com
 *   ADMIN_UUID / ADMIN_UUIDS=<uuid>   (optional designated admin user ids)
 *   # or single: ADMIN_EMAIL=you@example.com
 *
 * DB gate (`profiles.is_admin`) is checked in `@/lib/admin-server` only.
 */
import type { User } from "@supabase/supabase-js";

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

export function getAdminUuids(): string[] {
  const raw = process.env.ADMIN_UUIDS || process.env.ADMIN_UUID || "";
  return raw
    .split(",")
    .map((id) => id.trim().toLowerCase())
    .filter(Boolean);
}

export function isDesignatedAdminUuid(
  userId: string | null | undefined
): boolean {
  if (!userId) return false;
  const allowed = getAdminUuids();
  if (allowed.length === 0) return false;
  return allowed.includes(userId.trim().toLowerCase());
}

/** True when the user is an allowlisted email or designated admin UUID. */
export function isEnvAdmin(user: Pick<User, "id" | "email">): boolean {
  return isAdminEmail(user.email) || isDesignatedAdminUuid(user.id);
}

export const IMAGE_REVIEW_APPROVED_MESSAGE =
  "Thread approved and published to the public feed.";

export const IMAGE_REVIEW_REJECTED_MESSAGE =
  "Thread rejected and removed from the review queue.";
