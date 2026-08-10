import Link from "next/link";
import { Share2 } from "lucide-react";

import { ThreadCard } from "@/components/feed/thread-card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  type ThreadWithFootnotes,
} from "@/lib/types";
import { emptyVoteSummary, summarizeVotes, type VoteRow } from "@/lib/votes";

export default async function FeedPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("threads")
    .select("*, footnotes(id)")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load threads: ${error.message}`);
  }

  const threadIds = (data ?? []).map((row) => row.id);

  let threadVoteSummaries = new Map<string, ReturnType<typeof emptyVoteSummary>>();

  if (threadIds.length > 0) {
    const { data: votes, error: votesError } = await supabase
      .from("votes")
      .select("target_id, user_id, value")
      .eq("target_type", "thread")
      .in("target_id", threadIds);

    if (votesError) {
      throw new Error(`Failed to load thread votes: ${votesError.message}`);
    }

    threadVoteSummaries = summarizeVotes(
      (votes ?? []) as VoteRow[],
      threadIds,
      user?.id ?? null
    );
  }

  const threads: ThreadWithFootnotes[] = (data ?? []).map((row) => {
    const voteSummary =
      threadVoteSummaries.get(row.id) ?? emptyVoteSummary();

    return {
      ...row,
      content: asChatMessages(row.content),
      tags: Array.isArray(row.tags) ? row.tags : [],
      footnotes: asFootnotes(row.footnotes).map((footnote) => ({
        ...footnote,
        score: 0,
        userVote: null,
      })),
      score: voteSummary.score,
      userVote: voteSummary.userVote,
    };
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Discover</h1>
        <p className="text-muted-foreground">
          Browse shared AI conversations from the ChatShare community.
        </p>
      </header>

      {threads.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed px-6 py-16 text-center">
          <p className="text-muted-foreground">
            No threads found. Be the first to share a chat!
          </p>
          <Button asChild>
            <Link href="/share">
              <Share2 className="h-4 w-4" />
              Share a Chat
            </Link>
          </Button>
        </div>
      ) : (
        <section className="flex flex-col gap-4" aria-label="Thread feed">
          {threads.map((thread) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </section>
      )}
    </main>
  );
}
