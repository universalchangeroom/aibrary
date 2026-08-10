"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { VoteTargetType, VoteValue } from "@/lib/types";

export interface CastVoteInput {
  targetType: VoteTargetType;
  targetId: string;
  value: VoteValue;
  /** Path to revalidate after the vote changes (e.g. `/feed` or `/feed/[id]`). */
  path: string;
}

export interface CastVoteResult {
  success: boolean;
  error?: string;
  /** The caller's vote after the action (`null` if cleared). */
  userVote: VoteValue | null;
}

/**
 * Inserts, updates, or deletes a vote:
 * - No existing vote → insert
 * - Same value clicked again → delete (toggle off)
 * - Opposite value → update
 */
export async function castVote(input: CastVoteInput): Promise<CastVoteResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be signed in to vote.", userVote: null };
  }

  if (input.value !== 1 && input.value !== -1) {
    return { success: false, error: "Invalid vote value.", userVote: null };
  }

  if (input.targetType !== "thread" && input.targetType !== "footnote") {
    return { success: false, error: "Invalid vote target.", userVote: null };
  }

  const { data: existing, error: existingError } = await supabase
    .from("votes")
    .select("id, value")
    .eq("user_id", user.id)
    .eq("target_type", input.targetType)
    .eq("target_id", input.targetId)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message, userVote: null };
  }

  let nextUserVote: VoteValue | null = input.value;

  if (!existing) {
    const { error } = await supabase.from("votes").insert({
      user_id: user.id,
      target_type: input.targetType,
      target_id: input.targetId,
      value: input.value,
    });

    if (error) {
      return { success: false, error: error.message, userVote: null };
    }
  } else if (existing.value === input.value) {
    const { error } = await supabase.from("votes").delete().eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message, userVote: existing.value as VoteValue };
    }

    nextUserVote = null;
  } else {
    const { error } = await supabase
      .from("votes")
      .update({ value: input.value, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      return { success: false, error: error.message, userVote: existing.value as VoteValue };
    }
  }

  revalidatePath(input.path);
  if (input.path !== "/feed") {
    revalidatePath("/feed");
  }

  return { success: true, userVote: nextUserVote };
}
