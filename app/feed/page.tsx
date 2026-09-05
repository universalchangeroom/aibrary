import { ThreadList } from "@/components/feed/thread-list";
import { fetchAuthorsByIds } from "@/lib/author-profile";
import { createPublicClient } from "@/lib/supabase/public";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";

/** Discover feed: Incremental Static Regeneration every 60 seconds. */
export const revalidate = 60;

/**
 * Public Discover list of published threads.
 * Uses a cookie-free Supabase client so this page can be statically regenerated.
 * User-specific overlays (auth, Props balance) live in the client header.
 */
export default async function FeedPage() {
  const supabase = createPublicClient();

  // Discover feed: only fully published public threads (pending_review is hidden).
  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(id)"
    )
    .eq("is_public", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // Missing/null/errored queries must still render as an empty list — never throw.
  const rows = !error && Array.isArray(data) ? data : [];

  const authorIds = rows
    .map((row) =>
      row && typeof row === "object"
        ? (row as { author_id?: unknown }).author_id
        : null
    )
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  const authorsById = await fetchAuthorsByIds(supabase, authorIds);

  const threadList: ThreadWithFootnotes[] = (rows ?? []).flatMap((row) => {
    if (!row || typeof row !== "object" || typeof row.id !== "string") {
      return [];
    }

    const authorId =
      typeof row.author_id === "string" ? row.author_id : null;

    return [
      {
        ...row,
        total_tokens:
          typeof row.total_tokens === "number" ? row.total_tokens : 0,
        content: asChatMessages(
          threadContentFromRow(row as Record<string, unknown>)
        ),
        tags: Array.isArray(row.tags) ? row.tags : [],
        footnotes: asFootnotes(row.footnotes).map((footnote) => ({
          ...footnote,
          score: 0,
          userVote: null,
        })),
        // Public cache: no per-viewer vote overlay on Discover cards.
        score: 0,
        userVote: null,
        author: authorId
          ? authorsById.get(authorId) ?? { id: authorId, username: null }
          : null,
      } as ThreadWithFootnotes,
    ];
  });

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 text-stone-800">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="space-y-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-400/10 to-transparent px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Discover
          </h1>
          <p className="text-stone-600">
            Browse shared AI conversations from the ChatShare community.
          </p>
        </header>

        <ThreadList threads={threadList ?? []} variant="discover" />
      </main>
    </div>
  );
}
