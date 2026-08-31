"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { success: true; message?: string }
  | { success: false; error: string };

type GivePropsResult =
  | {
      success: true;
      message?: string;
      remainingBalance: number;
      totalTokens: number;
    }
  | { success: false; error: string };

type ToggleStarResult =
  | { success: true; starred: boolean }
  | { success: false; error: string };

const WEEKDAY_CAP: Record<string, number> = {
  Sun: 100,
  Mon: 100,
  Tue: 80,
  Wed: 80,
  Thu: 60,
  Fri: 60,
  Sat: 60,
};

function normalizeTimezone(tz: string | null): string {
  const fallback = "UTC";
  if (!tz || !tz.trim()) return fallback;

  try {
    // Throws for invalid timezone names.
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

function getLocalDayInfo(date: Date, timeZone: string): {
  dayKey: keyof typeof WEEKDAY_CAP;
  dateKey: string;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "Sun";
  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";

  const dayKey =
    weekday in WEEKDAY_CAP
      ? (weekday as keyof typeof WEEKDAY_CAP)
      : ("Sun" as const);

  return {
    dayKey,
    dateKey: `${year}-${month}-${day}`,
  };
}

/**
 * Applies weekly decay/reset rules to a user's Props balance.
 */
export async function evaluatePropsDecay(userId: string): Promise<ActionResult> {
  if (!userId) {
    return { success: false, error: "Missing user id." };
  }

  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("token_balance, timezone, last_token_reset")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: profileError?.message || "Profile not found.",
    };
  }

  const timeZone = normalizeTimezone(profile.timezone);
  const now = new Date();
  const nowInfo = getLocalDayInfo(now, timeZone);
  const lastResetDate = profile.last_token_reset
    ? new Date(profile.last_token_reset)
    : null;
  const lastResetInfo = lastResetDate
    ? getLocalDayInfo(lastResetDate, timeZone)
    : null;

  const currentBalance =
    typeof profile.token_balance === "number" ? profile.token_balance : 0;
  const todayCap = WEEKDAY_CAP[nowInfo.dayKey];

  let nextBalance = currentBalance;
  let shouldUpdate = false;

  // Sunday weekly top-up once per local Sunday.
  if (nowInfo.dayKey === "Sun") {
    if (lastResetInfo?.dateKey !== nowInfo.dateKey) {
      nextBalance = 100;
      shouldUpdate = true;
    }
  } else if (currentBalance > todayCap) {
    // Non-Sunday cap decay.
    nextBalance = todayCap;
    shouldUpdate = true;
  }

  if (!shouldUpdate) {
    return { success: true };
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      token_balance: nextBalance,
      last_token_reset: new Date().toISOString(),
    })
    .eq("id", userId);

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  return { success: true };
}

/**
 * Spends Props from the current user on a thread.
 */
export async function giveProps(
  threadId: string,
  amount: number
): Promise<GivePropsResult> {
  if (!threadId) {
    return { success: false, error: "Missing thread id." };
  }

  if (!Number.isInteger(amount) || amount <= 0) {
    return { success: false, error: "Props amount must be a positive integer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "You must be signed in to give Props." };
  }

  const decayResult = await evaluatePropsDecay(user.id);
  if (!decayResult.success) {
    return decayResult;
  }

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("id, author_id, total_tokens")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    return { success: false, error: threadError?.message || "Thread not found." };
  }

  if (thread.author_id === user.id) {
    return {
      success: false,
      error: "You cannot give Props to your own chat.",
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("token_balance, auto_unstar")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      success: false,
      error: profileError?.message || "Unable to load your token balance.",
    };
  }

  const balance = typeof profile.token_balance === "number" ? profile.token_balance : 0;
  if (amount > balance) {
    return { success: false, error: "Insufficient Props balance." };
  }

  const nextBalance = balance - amount;
  const threadTotal =
    typeof thread.total_tokens === "number" ? thread.total_tokens : 0;
  const nextTotal = threadTotal + amount;

  const { error: deductError } = await supabase
    .from("profiles")
    .update({ token_balance: nextBalance })
    .eq("id", user.id);

  if (deductError) {
    return { success: false, error: deductError.message };
  }

  const { error: addError } = await supabase
    .from("threads")
    .update({ total_tokens: nextTotal })
    .eq("id", threadId);

  if (addError) {
    return { success: false, error: addError.message };
  }

  const { error: ledgerError } = await supabase.from("token_transactions").insert({
    giver_id: user.id,
    thread_id: threadId,
    amount,
  });

  if (ledgerError) {
    return { success: false, error: ledgerError.message };
  }

  if (profile.auto_unstar !== false) {
    const { error: unstarError } = await supabase
      .from("starred_threads")
      .delete()
      .eq("user_id", user.id)
      .eq("thread_id", threadId);
    if (unstarError) {
      return { success: false, error: unstarError.message };
    }
  }

  revalidatePath(`/feed/${threadId}`);
  revalidatePath("/feed");

  return {
    success: true,
    remainingBalance: nextBalance,
    totalTokens: nextTotal,
  };
}

/**
 * Toggles whether the current user has starred a thread.
 */
export async function toggleStar(threadId: string): Promise<ToggleStarResult> {
  if (!threadId) {
    return { success: false, error: "Missing thread id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "You must be signed in to star threads." };
  }

  const { data: existing, error: existingError } = await supabase
    .from("starred_threads")
    .select("user_id, thread_id")
    .eq("user_id", user.id)
    .eq("thread_id", threadId)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("starred_threads")
      .delete()
      .eq("user_id", user.id)
      .eq("thread_id", threadId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    revalidatePath(`/feed/${threadId}`);
    return { success: true, starred: false };
  }

  const { error: insertError } = await supabase.from("starred_threads").insert({
    user_id: user.id,
    thread_id: threadId,
  });

  if (insertError) {
    return { success: false, error: insertError.message };
  }

  revalidatePath(`/feed/${threadId}`);
  return { success: true, starred: true };
}
