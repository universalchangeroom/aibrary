"use server";

import { revalidatePath } from "next/cache";

import {
  WEEKDAY_CAP,
  asTokenBalance,
  ensureViewerPropsBalance,
  getLocalDayInfo,
  normalizeTimezone,
  type EnsuredProfile,
} from "@/lib/props-balance";
import { PROPS_INFLUENCE_CAP } from "@/lib/props-cap";
import { createClient } from "@/lib/supabase/server";

type ActionResult =
  | { success: true; message?: string; profile?: EnsuredProfile }
  | { success: false; error: string };

type GivePropsResult =
  | {
      success: true;
      message?: string;
      remainingBalance: number;
      totalTokens: number;
    }
  | { success: false; error: string };

type RetractPropsResult =
  | {
      success: true;
      burnedAmount: number;
      totalTokens: number;
    }
  | { success: false; error: string };

type ToggleStarResult =
  | { success: true; starred: boolean }
  | { success: false; error: string };

function sumTransactionAmounts(
  rows: Array<{ amount?: unknown }> | null | undefined
): number {
  return (rows ?? []).reduce((sum, row) => {
    const amount =
      typeof row.amount === "number" && Number.isFinite(row.amount)
        ? Math.floor(row.amount)
        : 0;
    return sum + Math.max(0, amount);
  }, 0);
}

/**
 * Applies weekly decay/reset rules to a user's Props balance.
 * If the auth trigger never created a profiles row, upserts one with Honest Start.
 */
export async function evaluatePropsDecay(userId: string): Promise<ActionResult> {
  if (!userId) {
    return { success: false, error: "Missing user id." };
  }

  const supabase = await createClient();

  // Fallback when Supabase auth → profiles trigger fails silently.
  const ensured = await ensureViewerPropsBalance(supabase, userId);
  if (!ensured.profile || ensured.balance == null) {
    return {
      success: false,
      error:
        ("error" in ensured && ensured.error) ||
        "Unable to load or create profile.",
    };
  }

  let profile = ensured.profile;

  const timeZone = normalizeTimezone(profile.timezone);
  const now = new Date();
  const nowInfo = getLocalDayInfo(now, timeZone);
  const lastResetDate = profile.last_token_reset
    ? new Date(profile.last_token_reset)
    : null;
  const lastResetInfo = lastResetDate
    ? getLocalDayInfo(lastResetDate, timeZone)
    : null;

  const currentBalance = asTokenBalance(profile.token_balance) ?? 0;
  const todayCap = WEEKDAY_CAP[nowInfo.dayKey];

  let nextBalance = currentBalance;
  let shouldUpdate = false;

  // Sunday weekly top-up once per local Sunday (only grant day; never raise
  // mid-week balances up to the weekday cap on page load).
  if (nowInfo.dayKey === "Sun") {
    if (lastResetInfo?.dateKey !== nowInfo.dateKey) {
      nextBalance = 100;
      shouldUpdate = true;
    }
  } else if (currentBalance > todayCap) {
    // Cap DOWN only when over today's max (e.g. Mon 100 → Tue 80).
    // Never top up a spent balance to the weekday cap.
    nextBalance = todayCap;
    shouldUpdate = true;
  }

  if (!shouldUpdate) {
    return { success: true, profile };
  }

  const nowIso = new Date().toISOString();
  // Service role: user-scoped UPDATE can silently affect 0 rows under RLS.
  let updated: {
    id: string;
    token_balance: number | null;
    timezone: string | null;
    last_token_reset: string | null;
    auto_unstar: boolean | null;
  } | null = null;
  let updateError: { message: string } | null = null;

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const result = await admin
      .from("profiles")
      .update({
        token_balance: nextBalance,
        last_token_reset: nowIso,
      })
      .eq("id", userId)
      .select("id, token_balance, timezone, last_token_reset, auto_unstar")
      .maybeSingle();
    updated = result.data;
    updateError = result.error;
  } catch (err) {
    updateError = {
      message:
        err instanceof Error
          ? err.message
          : "Service role is required to apply Props decay.",
    };
  }

  if (updateError) {
    return { success: false, error: updateError.message };
  }

  if (!updated) {
    return {
      success: false,
      error: "Failed to update Props balance (no profile row updated).",
    };
  }

  profile = {
    id: userId,
    token_balance: asTokenBalance(updated.token_balance) ?? nextBalance,
    timezone: (updated?.timezone as string | null) ?? profile.timezone,
    last_token_reset:
      (updated?.last_token_reset as string | null) ?? nowIso,
    auto_unstar: (updated?.auto_unstar as boolean | null) ?? profile.auto_unstar,
  };

  return { success: true, profile };
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

  const { data: priorGifts, error: priorError } = await supabase
    .from("token_transactions")
    .select("amount")
    .eq("giver_id", user.id)
    .eq("thread_id", threadId);

  if (priorError) {
    return { success: false, error: priorError.message };
  }

  const previouslyGiven = sumTransactionAmounts(priorGifts);
  if (previouslyGiven + amount > PROPS_INFLUENCE_CAP) {
    const remaining = Math.max(0, PROPS_INFLUENCE_CAP - previouslyGiven);
    return {
      success: false,
      error:
        remaining === 0
          ? `You have reached the ${PROPS_INFLUENCE_CAP}-Prop Influence Cap for this thread.`
          : `Influence Cap: you can give at most ${remaining} more Props to this thread (${PROPS_INFLUENCE_CAP} total).`,
    };
  }

  // Prefer profile returned from decay/ensure so we never fail on a missing row.
  let profile = decayResult.profile;
  if (!profile) {
    const ensured = await ensureViewerPropsBalance(supabase, user.id);
    if (!ensured.profile) {
      return {
        success: false,
        error:
          ("error" in ensured && ensured.error) ||
          "Unable to load your token balance.",
      };
    }
    profile = ensured.profile;
  }

  const balance = asTokenBalance(profile.token_balance) ?? 0;
  if (amount > balance) {
    return { success: false, error: "Insufficient Props balance." };
  }

  const nextBalance = balance - amount;
  const threadTotal =
    typeof thread.total_tokens === "number" ? thread.total_tokens : 0;
  const nextTotal = threadTotal + amount;

  // Profile token_balance UPDATE can silently affect 0 rows under RLS
  // (same class of failure that blocked thread total_tokens for givers).
  // Use the service role and require a returned row with the DB balance.
  let deductError: { message: string } | null = null;
  let remainingBalance: number | null = null;
  let admin: ReturnType<
    typeof import("@/lib/supabase/admin").createServiceClient
  > | null = null;

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    admin = createServiceClient();
    const { data: updatedProfile, error } = await admin
      .from("profiles")
      .update({ token_balance: nextBalance })
      .eq("id", user.id)
      .select("id, token_balance")
      .maybeSingle();

    const dbBalance = asTokenBalance(updatedProfile?.token_balance);

    console.log("[giveProps] profile deduct", {
      userId: user.id,
      startingBalance: balance,
      amount,
      nextBalance,
      updatedProfile,
      dbBalance,
      error: error?.message ?? null,
    });

    if (error) {
      deductError = error;
    } else if (!updatedProfile) {
      deductError = {
        message: "Failed to deduct Props (no profile row updated).",
      };
    } else if (dbBalance == null) {
      deductError = {
        message: "Failed to deduct Props (DB returned a non-numeric balance).",
      };
    } else if (dbBalance !== nextBalance) {
      deductError = {
        message: `Props deduct mismatch: expected ${nextBalance}, DB returned ${dbBalance}.`,
      };
    } else {
      remainingBalance = dbBalance;
    }
  } catch (err) {
    deductError = {
      message:
        err instanceof Error
          ? err.message
          : "Service role is required to deduct Props.",
    };
  }

  if (deductError || remainingBalance == null) {
    return {
      success: false,
      error: deductError?.message || "Failed to deduct Props.",
    };
  }

  // Authors-only UPDATE RLS blocks givers from bumping total_tokens.
  // Use the service role for this column increment only.
  let addError: { message: string } | null = null;
  try {
    if (!admin) {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      admin = createServiceClient();
    }
    const { data: updatedThread, error } = await admin
      .from("threads")
      .update({ total_tokens: nextTotal })
      .eq("id", threadId)
      .select("id, total_tokens")
      .maybeSingle();

    if (error) {
      addError = error;
    } else if (!updatedThread) {
      addError = { message: "Failed to update thread Props total." };
    }
  } catch (err) {
    addError = {
      message:
        err instanceof Error
          ? err.message
          : "Service role is required to credit thread Props.",
    };
  }

  if (addError) {
    // Rollback giver balance with service role so we do not leave a partial spend.
    if (admin) {
      await admin
        .from("profiles")
        .update({ token_balance: balance })
        .eq("id", user.id);
    }
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

  // Refresh layout (header balance) + feed/thread/portfolio surfaces.
  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/feed/${threadId}`);
  revalidatePath(`/user/${user.id}`);
  if (thread.author_id) {
    revalidatePath(`/user/${thread.author_id}`);
  }

  console.log("[giveProps] success", {
    userId: user.id,
    remainingBalance,
    totalTokens: nextTotal,
  });

  return {
    success: true,
    // Always the value returned by the service-role SELECT after UPDATE.
    remainingBalance,
    totalTokens: nextTotal,
  };
}

/**
 * Retracts (burns) all Props the current user previously gave to a thread.
 * Ledger rows are deleted and the thread total is decremented, but the giver's
 * wallet balance is NOT refunded — burned Props are gone permanently.
 */
export async function retractProps(
  threadId: string
): Promise<RetractPropsResult> {
  if (!threadId) {
    return { success: false, error: "Missing thread id." };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { success: false, error: "You must be signed in to retract Props." };
  }

  const { data: gifts, error: giftsError } = await supabase
    .from("token_transactions")
    .select("id, amount")
    .eq("giver_id", user.id)
    .eq("thread_id", threadId);

  if (giftsError) {
    return { success: false, error: giftsError.message };
  }

  const burnedAmount = sumTransactionAmounts(gifts);
  if (burnedAmount <= 0 || !gifts || gifts.length === 0) {
    return {
      success: false,
      error: "You have not given any Props to this thread.",
    };
  }

  const { data: thread, error: threadError } = await supabase
    .from("threads")
    .select("id, author_id, total_tokens")
    .eq("id", threadId)
    .single();

  if (threadError || !thread) {
    return { success: false, error: threadError?.message || "Thread not found." };
  }

  const threadTotal =
    typeof thread.total_tokens === "number" ? thread.total_tokens : 0;
  const nextTotal = Math.max(0, threadTotal - burnedAmount);

  let admin: ReturnType<
    typeof import("@/lib/supabase/admin").createServiceClient
  >;

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    admin = createServiceClient();
  } catch (err) {
    return {
      success: false,
      error:
        err instanceof Error
          ? err.message
          : "Service role is required to retract Props.",
    };
  }

  // No DELETE RLS on token_transactions for givers — burn via service role.
  // Intentionally does NOT credit profiles.token_balance (Burn Rule).
  const { error: deleteError } = await admin
    .from("token_transactions")
    .delete()
    .eq("giver_id", user.id)
    .eq("thread_id", threadId);

  if (deleteError) {
    return { success: false, error: deleteError.message };
  }

  const { data: updatedThread, error: totalError } = await admin
    .from("threads")
    .update({ total_tokens: nextTotal })
    .eq("id", threadId)
    .select("id, total_tokens")
    .maybeSingle();

  if (totalError) {
    return { success: false, error: totalError.message };
  }

  if (!updatedThread) {
    return { success: false, error: "Failed to update thread Props total." };
  }

  const syncedTotal =
    typeof updatedThread.total_tokens === "number"
      ? Math.max(0, updatedThread.total_tokens)
      : nextTotal;

  revalidatePath("/", "layout");
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(`/feed/${threadId}`);
  revalidatePath(`/user/${user.id}`);
  if (thread.author_id) {
    revalidatePath(`/user/${thread.author_id}`);
  }

  return {
    success: true,
    burnedAmount,
    totalTokens: syncedTotal,
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
