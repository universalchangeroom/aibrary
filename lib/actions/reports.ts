"use server";

import { revalidatePath } from "next/cache";

import { isAdminUser } from "@/lib/admin-server";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ReportActionResult =
  | { success: true; message: string }
  | { success: false; error: string };

async function requireAdminActor(): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { ok: false, error: "Sign in required." };
  }

  if (!(await isAdminUser(user))) {
    return { ok: false, error: "Forbidden. Admin access only." };
  }

  return { ok: true };
}

/**
 * Dismiss a pending report without changing the thread.
 */
export async function dismissReport(
  reportId: string
): Promise<ReportActionResult> {
  const id = reportId.trim();
  if (!UUID_RE.test(id)) {
    return { success: false, error: "A valid report id is required." };
  }

  const auth = await requireAdminActor();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("reports")
      .update({ status: "DISMISSED" })
      .eq("id", id)
      .eq("status", "PENDING")
      .select("id")
      .maybeSingle();

    if (error) {
      return { success: false, error: error.message };
    }
    if (!data) {
      return { success: false, error: "Pending report not found." };
    }

    revalidatePath("/admin/reports");
    return { success: true, message: "Report dismissed." };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to dismiss report.",
    };
  }
}

/**
 * Delete the reported thread and mark the report RESOLVED.
 */
export async function deleteThreadAndResolveReport(
  reportId: string
): Promise<ReportActionResult> {
  const id = reportId.trim();
  if (!UUID_RE.test(id)) {
    return { success: false, error: "A valid report id is required." };
  }

  const auth = await requireAdminActor();
  if (!auth.ok) {
    return { success: false, error: auth.error };
  }

  try {
    const admin = createServiceClient();

    const { data: report, error: fetchError } = await admin
      .from("reports")
      .select("id, thread_id, status")
      .eq("id", id)
      .maybeSingle();

    if (fetchError) {
      return { success: false, error: fetchError.message };
    }
    if (!report || report.status !== "PENDING") {
      return { success: false, error: "Pending report not found." };
    }

    const threadId =
      typeof report.thread_id === "string" ? report.thread_id : null;

    const { error: resolveError } = await admin
      .from("reports")
      .update({ status: "RESOLVED" })
      .eq("id", id);

    if (resolveError) {
      return { success: false, error: resolveError.message };
    }

    if (threadId) {
      const { error: deleteError } = await admin
        .from("threads")
        .delete()
        .eq("id", threadId);

      if (deleteError) {
        return { success: false, error: deleteError.message };
      }

      revalidatePath("/feed");
      revalidatePath(`/feed/${threadId}`);
    }

    revalidatePath("/admin/reports");
    return {
      success: true,
      message: "Thread deleted and report resolved.",
    };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Failed to delete thread and resolve report.",
    };
  }
}
