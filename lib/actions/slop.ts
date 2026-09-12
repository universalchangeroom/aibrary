"use server";

import { revalidatePath } from "next/cache";

import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type MarkSlopResult =
  | { success: true; slopCount: number; alreadyMarked?: boolean }
  | { success: false; error: string };

/**
 * Mark a thread with Mr. Slop (once per user). Increments threads.slop_count.
 */
export async function markSlop(threadId: string): Promise<MarkSlopResult> {
  const id = threadId.trim();
  if (!id) {
    return { success: false, error: "Thread id is required." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "You must be signed in to mark slop." };
  }

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("id, author_id, slop_count")
    .eq("id", id)
    .maybeSingle();

  if (threadError || !thread) {
    return { success: false, error: threadError?.message || "Thread not found." };
  }

  if (thread.author_id === user.id) {
    return { success: false, error: "You cannot slop your own chat." };
  }

  const { data: existing } = await supabase
    .from("slop_marks")
    .select("thread_id")
    .eq("user_id", user.id)
    .eq("thread_id", id)
    .maybeSingle();

  const currentSlop =
    typeof thread.slop_count === "number" ? Math.max(0, thread.slop_count) : 0;

  if (existing) {
    return { success: true, slopCount: currentSlop, alreadyMarked: true };
  }

  const { error: markError } = await supabase.from("slop_marks").insert({
    user_id: user.id,
    thread_id: id,
  });

  if (markError) {
    // Unique race: treat as already marked.
    if (markError.code === "23505") {
      return { success: true, slopCount: currentSlop, alreadyMarked: true };
    }
    return { success: false, error: markError.message };
  }

  const nextSlop = currentSlop + 1;

  try {
    const admin = createServiceClient();
    const { data: updated, error: updateError } = await admin
      .from("threads")
      .update({ slop_count: nextSlop })
      .eq("id", id)
      .select("slop_count")
      .maybeSingle();

    if (updateError || !updated) {
      return {
        success: false,
        error: updateError?.message || "Failed to update slop count.",
      };
    }

    const slopCount =
      typeof updated.slop_count === "number" ? updated.slop_count : nextSlop;

    revalidatePath("/feed");
    revalidatePath(`/feed/${id}`);

    return { success: true, slopCount };
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error ? err.message : "Failed to update slop count.",
    };
  }
}
