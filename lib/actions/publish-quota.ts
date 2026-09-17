"use server";

import {
  buildPublishQuotaSnapshot,
  isPublishAdmin,
  startOfUtcDayIso,
  type PublishQuotaSnapshot,
} from "@/lib/publish-quota";
import { createClient } from "@/lib/supabase/server";

/**
 * Cookie-bound publish quota for the Share / Importer UI.
 */
export async function getViewerPublishQuota(): Promise<PublishQuotaSnapshot | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  const admin = isPublishAdmin(user, profile?.is_admin);

  const { count, error } = await supabase
    .from("threads")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .gte("created_at", startOfUtcDayIso());

  if (error) {
    console.error("[getViewerPublishQuota]", error.message);
    return buildPublishQuotaSnapshot({ isAdmin: admin, used: 0 });
  }

  return buildPublishQuotaSnapshot({
    isAdmin: admin,
    used: count ?? 0,
  });
}
