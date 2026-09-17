/**
 * Daily curated-thread publish quota (Honest Start publishing cadence).
 * Admins (`profiles.is_admin` or ADMIN_EMAILS / ADMIN_UUID) are unlimited.
 */
import type { User } from "@supabase/supabase-js";

import { isEnvAdmin } from "@/lib/admin";

export const DAILY_PUBLISH_LIMIT = 5;

export type PublishQuotaSnapshot = {
  isAdmin: boolean;
  used: number;
  limit: number;
  /** `null` when the viewer has unlimited publishes (admin). */
  remaining: number | null;
};

export function startOfUtcDayIso(now = new Date()): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  ).toISOString();
}

export function isPublishAdmin(
  user: Pick<User, "id" | "email">,
  profileIsAdmin: boolean | null | undefined
): boolean {
  return profileIsAdmin === true || isEnvAdmin(user);
}

export function buildPublishQuotaSnapshot(args: {
  isAdmin: boolean;
  used: number;
}): PublishQuotaSnapshot {
  const used = Math.max(0, Math.floor(args.used));
  if (args.isAdmin) {
    return {
      isAdmin: true,
      used,
      limit: DAILY_PUBLISH_LIMIT,
      remaining: null,
    };
  }
  return {
    isAdmin: false,
    used,
    limit: DAILY_PUBLISH_LIMIT,
    remaining: Math.max(0, DAILY_PUBLISH_LIMIT - used),
  };
}
