import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ThreadDetailView } from "@/components/feed/thread-detail-view";
import { Button } from "@/components/ui/button";
import { ensureViewerPropsBalance } from "@/lib/props-balance";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";
import { emptyVoteSummary, summarizeVotes, type VoteRow } from "@/lib/votes";

export const dynamic = "force-dynamic";

interface ThreadPageProps {
  params: Promise<{ id: string }> | { id: string };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { id } = await Promise.resolve(params);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(*)"
    )
    .eq("id", id)
    .order("created_at", { ascending: true, foreignTable: "footnotes" })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load thread: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  // Non-authors must not open unpublished (pending_review) threads via direct URL.
  // (RLS already hides them; this is a belt-and-suspenders check for the owner path.)
  const isOwner = user?.id && data.author_id === user.id;
  const isPublishedPublic =
    data.is_public === true &&
    (data.status == null || data.status === "published");
  if (!isOwner && !isPublishedPublic) {
    notFound();
  }

  const footnotes = asFootnotes(data.footnotes);
  const footnoteIds = footnotes.map((footnote) => footnote.id);
  const currentUserId = user?.id ?? null;

  const voteQueries = [
    supabase
      .from("votes")
      .select("target_id, user_id, value")
      .eq("target_type", "thread")
      .eq("target_id", id),
  ];

  if (footnoteIds.length > 0) {
    voteQueries.push(
      supabase
        .from("votes")
        .select("target_id, user_id, value")
        .eq("target_type", "footnote")
        .in("target_id", footnoteIds)
    );
  }

  const voteResults = await Promise.all(voteQueries);

  for (const result of voteResults) {
    if (result.error) {
      throw new Error(`Failed to load votes: ${result.error.message}`);
    }
  }

  const threadVotes = (voteResults[0].data ?? []) as VoteRow[];
  const footnoteVotes =
    footnoteIds.length > 0
      ? ((voteResults[1]?.data ?? []) as VoteRow[])
      : [];

  const threadVoteSummary =
    summarizeVotes(threadVotes, [id], user?.id ?? null).get(id) ??
    emptyVoteSummary();

  const footnoteVoteSummaries = summarizeVotes(
    footnoteVotes,
    footnoteIds,
    user?.id ?? null
  );

  const thread: ThreadWithFootnotes = {
    ...data,
    content: asChatMessages(
      threadContentFromRow(data as Record<string, unknown>)
    ),
    tags: Array.isArray(data.tags) ? data.tags : [],
    footnotes: footnotes.map((footnote) => {
      const summary =
        footnoteVoteSummaries.get(footnote.id) ?? emptyVoteSummary();
      return {
        ...footnote,
        score: summary.score,
        userVote: summary.userVote,
      };
    }),
    score: threadVoteSummary.score,
    userVote: threadVoteSummary.userVote,
  };

  let viewerTokenBalance: number | null = null;
  let viewerHasStarred = false;

  if (currentUserId) {
    // Server-only: ensure profile + Honest Start balance, then pass as props.
    // ThreadActions must not fetch balance on the client (hydration-safe).
    const [balanceResult, { data: star }] = await Promise.all([
      ensureViewerPropsBalance(supabase, currentUserId),
      supabase
        .from("starred_threads")
        .select("user_id, thread_id")
        .eq("user_id", currentUserId)
        .eq("thread_id", id)
        .maybeSingle(),
    ]);

    viewerTokenBalance = balanceResult.balance;
    if ("error" in balanceResult && balanceResult.error) {
      console.error(
        "[feed/thread] failed to ensure viewer Props balance:",
        balanceResult.error
      );
    }
    viewerHasStarred = Boolean(star);
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <Button variant="ghost" size="sm" className="-ml-2 -mb-1 w-fit" asChild>
        <Link href="/feed">
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
      </Button>

      <ThreadDetailView
        key={thread.id}
        thread={thread}
        isAuthenticated={Boolean(user)}
        currentUserId={currentUserId}
        viewerTokenBalance={viewerTokenBalance}
        viewerHasStarred={viewerHasStarred}
      />
    </main>
  );
}
