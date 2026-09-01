import type { SupabaseClient } from "@supabase/supabase-js";

/** Day-of-week Props caps (Honest Start / Generosification schedule). */
export const WEEKDAY_CAP: Record<string, number> = {
  Sun: 100,
  Mon: 100,
  Tue: 80,
  Wed: 80,
  Thu: 60,
  Fri: 60,
  Sat: 60,
};

export type EnsuredProfile = {
  id: string;
  token_balance: number;
  timezone: string | null;
  last_token_reset: string | null;
  auto_unstar?: boolean | null;
};

type EnsureResult =
  | { balance: number; profile: EnsuredProfile; ensured: boolean }
  | { balance: null; profile: null; error: string };

type ProfileRow = {
  id: string;
  token_balance: unknown;
  timezone: string | null;
  last_token_reset: string | null;
  auto_unstar: boolean | null;
};

/** Coerce PostgREST numeric / string balances to a finite number. */
export function asTokenBalance(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toEnsuredProfile(row: ProfileRow): EnsuredProfile | null {
  const balance = asTokenBalance(row.token_balance);
  if (balance == null) return null;
  return {
    id: row.id,
    token_balance: balance,
    timezone: row.timezone ?? null,
    last_token_reset: row.last_token_reset ?? null,
    auto_unstar: row.auto_unstar ?? true,
  };
}

function isUninitialized(
  balance: number | null,
  lastTokenReset: string | null
): boolean {
  return balance === 0 && lastTokenReset == null;
}

export function normalizeTimezone(tz: string | null | undefined): string {
  const fallback = "UTC";
  if (!tz || !tz.trim()) return fallback;

  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return fallback;
  }
}

export function getLocalDayInfo(
  date: Date,
  timeZone: string
): {
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

/** Honest Start balance for the user's local weekday (Sun/Mon=100, Tue/Wed=80, else 60). */
export function getHonestStartBalance(
  date: Date = new Date(),
  timeZone: string = "UTC"
): number {
  const { dayKey } = getLocalDayInfo(date, normalizeTimezone(timeZone));
  return WEEKDAY_CAP[dayKey];
}

async function selectProfile(
  client: SupabaseClient,
  userId: string
): Promise<{ row: ProfileRow | null; error: string | null }> {
  const { data, error } = await client
    .from("profiles")
    .select("id, token_balance, timezone, last_token_reset, auto_unstar")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    return { row: null, error: error.message };
  }
  return { row: (data as ProfileRow | null) ?? null, error: null };
}

/**
 * Loads the viewer's Props profile. If the row is missing, inserts one with
 * Honest Start balance so the UI can render immediately even when the
 * auth.users → profiles trigger failed silently.
 *
 * Never UPSERT/UPDATE token_balance for an already-initialized profile
 * (spent balances must not be overwritten with weekday Honest Start on load).
 */
export async function ensureViewerPropsBalance(
  supabase: SupabaseClient,
  userId: string
): Promise<EnsureResult> {
  let profile: ProfileRow | null = null;

  const { row: selected, error: selectError } = await selectProfile(
    supabase,
    userId
  );

  if (selectError) {
    console.error(
      "[ensureViewerPropsBalance] profile select failed:",
      selectError
    );
    return { balance: null, profile: null, error: selectError };
  }

  profile = selected;

  // If user-scoped SELECT missed the row, confirm via service role before writing.
  if (!profile) {
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      const admin = createServiceClient();
      const { row: adminRow, error: adminSelectError } = await selectProfile(
        admin,
        userId
      );
      if (!adminSelectError && adminRow) {
        profile = adminRow;
      }
    } catch (adminErr) {
      console.error(
        "[ensureViewerPropsBalance] service-role select unavailable:",
        adminErr
      );
    }
  }

  const existingBalance = profile ? asTokenBalance(profile.token_balance) : null;
  // Only bootstrap never-initialized rows (0 + no reset stamp). Never treat a
  // spent-down balance as uninitialized, and never top up to today's weekday cap.
  const looksUninitialized =
    profile != null &&
    isUninitialized(existingBalance, profile.last_token_reset);

  if (profile && existingBalance != null && !looksUninitialized) {
    const ensured = toEnsuredProfile(profile);
    if (ensured) {
      return {
        balance: ensured.token_balance,
        profile: ensured,
        ensured: false,
      };
    }
  }

  const startingBalance = getHonestStartBalance(
    new Date(),
    profile?.timezone ?? "UTC"
  );
  const nowIso = new Date().toISOString();

  if (!profile) {
    const payload = {
      id: userId,
      username: null as string | null,
      token_balance: startingBalance,
      timezone: "UTC",
      last_token_reset: nowIso,
      auto_unstar: true,
    };

    // INSERT only — ignoreDuplicates so we never overwrite an existing balance.
    let inserted: ProfileRow | null = null;
    let insertError: { message: string } | null = null;

    const firstAttempt = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "id", ignoreDuplicates: true })
      .select("id, token_balance, timezone, last_token_reset, auto_unstar")
      .maybeSingle();

    inserted = firstAttempt.data as ProfileRow | null;
    insertError = firstAttempt.error;

    if (insertError || !inserted) {
      try {
        const { createServiceClient } = await import("@/lib/supabase/admin");
        const admin = createServiceClient();
        const adminAttempt = await admin
          .from("profiles")
          .upsert(payload, { onConflict: "id", ignoreDuplicates: true })
          .select("id, token_balance, timezone, last_token_reset, auto_unstar")
          .maybeSingle();
        inserted = adminAttempt.data as ProfileRow | null;
        insertError = adminAttempt.error;
      } catch (adminErr) {
        console.error(
          "[ensureViewerPropsBalance] service-role fallback unavailable:",
          adminErr
        );
      }
    }

    // ignoreDuplicates: existing row → maybeSingle may return null; re-read.
    const rereadClients: SupabaseClient[] = [supabase];
    try {
      const { createServiceClient } = await import("@/lib/supabase/admin");
      rereadClients.push(createServiceClient());
    } catch {
      // optional
    }

    for (const client of rereadClients) {
      const { row: raced, error: racedError } = await selectProfile(
        client,
        userId
      );
      if (!racedError && raced) {
        const racedProfile = toEnsuredProfile(raced);
        if (racedProfile) {
          return {
            balance: racedProfile.token_balance,
            profile: racedProfile,
            ensured: true,
          };
        }
      }
    }

    if (insertError || !inserted) {
      console.error(
        "[ensureViewerPropsBalance] profile insert failed:",
        insertError?.message
      );
      return {
        balance: null,
        profile: null,
        error: insertError?.message || "Failed to create profile.",
      };
    }

    const created = toEnsuredProfile(inserted);
    return {
      balance: created?.token_balance ?? startingBalance,
      profile: created ?? {
        id: inserted.id,
        token_balance: startingBalance,
        timezone: inserted.timezone ?? "UTC",
        last_token_reset: inserted.last_token_reset ?? nowIso,
        auto_unstar: inserted.auto_unstar ?? true,
      },
      ensured: true,
    };
  }

  // Profile exists but is truly uninitialized (0 + no reset) or non-numeric.
  // Prefer service role so RLS cannot silently affect 0 rows.
  let updated: ProfileRow | null = null;
  let updateError: { message: string } | null = null;

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    const result = await admin
      .from("profiles")
      .update({
        token_balance: startingBalance,
        last_token_reset: nowIso,
      })
      .eq("id", userId)
      .select("id, token_balance, timezone, last_token_reset, auto_unstar")
      .maybeSingle();
    updated = result.data as ProfileRow | null;
    updateError = result.error;
  } catch {
    const result = await supabase
      .from("profiles")
      .update({
        token_balance: startingBalance,
        last_token_reset: nowIso,
      })
      .eq("id", userId)
      .select("id, token_balance, timezone, last_token_reset, auto_unstar")
      .maybeSingle();
    updated = result.data as ProfileRow | null;
    updateError = result.error;
  }

  if (updateError || !updated) {
    console.error(
      "[ensureViewerPropsBalance] profile update failed:",
      updateError?.message
    );
    return {
      balance: null,
      profile: null,
      error: updateError?.message || "Failed to initialize token balance.",
    };
  }

  const initialized = toEnsuredProfile(updated);
  return {
    balance: initialized?.token_balance ?? startingBalance,
    profile: initialized ?? {
      id: updated.id,
      token_balance: startingBalance,
      timezone: updated.timezone ?? null,
      last_token_reset: updated.last_token_reset ?? nowIso,
      auto_unstar: updated.auto_unstar ?? true,
    },
    ensured: true,
  };
}
