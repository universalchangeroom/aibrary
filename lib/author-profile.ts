/** Public author fields attached to threads for attribution. */
export type AuthorProfile = {
  id: string;
  username: string | null;
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  created_at?: string | null;
  /** Optional email used only for display fallback (never shown raw). */
  email?: string | null;
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value.trim());
}

/** Visible handle for UI: username, display name, email prefix, or Anonymous. */
export function authorDisplayName(author: AuthorProfile | null | undefined): string {
  if (!author) return "Anonymous";

  const username = author.username?.trim();
  if (username) return username.startsWith("@") ? username.slice(1) : username;

  const displayName = author.display_name?.trim();
  if (displayName) return displayName;

  const email = author.email?.trim();
  if (email) {
    const prefix = email.split("@")[0]?.trim();
    if (prefix) return prefix;
  }

  return "Anonymous";
}

/** Portfolio path: prefer username, fall back to author id. */
export function authorPortfolioHref(
  author: AuthorProfile | null | undefined,
  authorId?: string | null
): string | null {
  const id = author?.id || authorId;
  if (!id) return null;

  const username = author?.username?.trim();
  if (username) {
    return `/user/${encodeURIComponent(username.replace(/^@/, ""))}`;
  }

  return `/user/${encodeURIComponent(id)}`;
}

export function asAuthorProfile(value: unknown): AuthorProfile | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== "string" || !row.id) return null;

  return {
    id: row.id,
    username: typeof row.username === "string" ? row.username : null,
    display_name:
      typeof row.display_name === "string" ? row.display_name : null,
    bio: typeof row.bio === "string" ? row.bio : null,
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    email: typeof row.email === "string" ? row.email : null,
  };
}

/**
 * Soft-enrich authors that lack a username with auth email prefixes
 * (service-role only; failures are ignored).
 */
export async function enrichAuthorsWithEmails(
  authors: Map<string, AuthorProfile>
): Promise<void> {
  const missing = [...authors.values()].filter(
    (author) => !author.username?.trim() && !author.email?.trim()
  );
  if (missing.length === 0) return;

  try {
    const { createServiceClient } = await import("@/lib/supabase/admin");
    const admin = createServiceClient();
    await Promise.all(
      missing.map(async (author) => {
        try {
          const { data, error } = await admin.auth.admin.getUserById(author.id);
          if (error || !data.user?.email) return;
          const current = authors.get(author.id);
          if (!current) return;
          authors.set(author.id, { ...current, email: data.user.email });
        } catch {
          // ignore per-user lookup failures
        }
      })
    );
  } catch {
    // Service role unavailable — keep username/Anonymous fallbacks.
  }
}

/** Batch-load profile rows for thread author_id values. */
export async function fetchAuthorsByIds(
  // Accept the server/browser Supabase client without tight generic coupling.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: { from: (table: string) => any },
  authorIds: string[]
): Promise<Map<string, AuthorProfile>> {
  const unique = Array.from(new Set(authorIds.filter(Boolean)));
  const map = new Map<string, AuthorProfile>();

  if (unique.length === 0) return map;

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .in("id", unique);

  for (const row of data ?? []) {
    const author = asAuthorProfile(row);
    if (author) map.set(author.id, author);
  }

  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, { id, username: null });
    }
  }

  await enrichAuthorsWithEmails(map);
  return map;
}
