import { ThreadList } from "@/components/feed/thread-list";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";
import { emptyVoteSummary, summarizeVotes, type VoteRow } from "@/lib/votes";

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Discover feed: only fully published public threads (pending_review is hidden).
  const { data, error } = await supabase
    .from("threads")
    .select("*, footnotes(id)")
    .eq("is_public", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  // Missing/null/errored queries must still render as an empty list — never throw.
  const rows = !error && Array.isArray(data) ? data : [];
  const threadIds = rows
    .map((row) => (row && typeof row === "object" ? (row as { id?: unknown }).id : null))
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  let threadVoteSummaries = new Map<string, ReturnType<typeof emptyVoteSummary>>();

  if (threadIds.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("target_id, user_id, value")
      .eq("target_type", "thread")
      .in("target_id", threadIds);

    threadVoteSummaries = summarizeVotes(
      (votes ?? []) as VoteRow[],
      threadIds,
      user?.id ?? null
    );
  }

  const threadList: ThreadWithFootnotes[] = (rows ?? []).flatMap((row) => {
    if (!row || typeof row !== "object" || typeof row.id !== "string") {
      return [];
    }

    const voteSummary =
      threadVoteSummaries.get(row.id) ?? emptyVoteSummary();

    return [
      {
        ...row,
        content: asChatMessages(
          threadContentFromRow(row as Record<string, unknown>)
        ),
        tags: Array.isArray(row.tags) ? row.tags : [],
        footnotes: asFootnotes(row.footnotes).map((footnote) => ({
          ...footnote,
          score: 0,
          userVote: null,
        })),
        score: voteSummary.score,
        userVote: voteSummary.userVote,
      } as ThreadWithFootnotes,
    ];
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="text-muted-foreground">
          Browse shared AI conversations from the ChatShare community.
        </p>
      </header>

      <ThreadList threads={threadList ?? []} />
    </main>
  );
}
