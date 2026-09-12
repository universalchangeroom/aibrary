/**
 * Server-only admin checks (uses next/headers via Supabase server client).
 * Do not import this module from Client Components.
 */
import "server-only";

import type { User } from "@supabase/supabase-js";

import { isEnvAdmin } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Full admin gate for reports dashboard:
 * profiles.is_admin OR designated ADMIN_UUID OR ADMIN_EMAILS allowlist.
 */
export async function isAdminUser(
  user: Pick<User, "id" | "email">
): Promise<boolean> {
  if (isEnvAdmin(user)) return true;

  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (data?.is_admin === true) return true;
  } catch {
    // Fall through to service-role check.
  }

  try {
    const admin = createServiceClient();
    const { data } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();
    return data?.is_admin === true;
  } catch {
    return false;
  }
}
