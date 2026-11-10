"use server";

import { fetchAuthorsByIds } from "@/lib/author-profile";
import { ensureViewerPropsBalance } from "@/lib/props-balance";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";
import { emptyVoteSummary, summarizeVotes, type VoteRow } from "@/lib/votes";

export type ReaderThreadPayload = {
  thread: ThreadWithFootnotes;
  isAuthenticated: boolean;
  currentUserId: string | null;
  viewerTokenBalance: number | null;
  viewerHasStarred: boolean;
  viewerGivenProps: number;
};

/**
 * Load a published (or owner-visible) thread for the Tabbed Reader panel.
 */
export async function getReaderThread(
  threadId: string
): Promise<ReaderThreadPayload | null> {
  const id = threadId.trim();
  if (!id) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, source_model, source_url, artifact_url, artifact_type, tags, is_public, status, total_tokens, props_count, slop_count, created_at, updated_at, footnotes(*)"
    )
    .eq("id", id)
    .order("created_at", { ascending: true, foreignTable: "footnotes" })
    .maybeSingle();

  if (error || !data) return null;

  const isOwner = Boolean(user?.id && data.author_id === user.id);
  const isPublishedPublic =
    data.is_public === true &&
    (data.status == null || data.status === "published");
  if (!isOwner && !isPublishedPublic) return null;

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

  const [voteResults, authorsById] = await Promise.all([
    Promise.all(voteQueries),
    fetchAuthorsByIds(supabase, [data.author_id as string]),
  ]);

  for (const result of voteResults) {
    if (result.error) {
      console.error("[getReaderThread] votes:", result.error.message);
      return null;
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

  const authorId = data.author_id as string;
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
    author: authorsById.get(authorId) ?? { id: authorId, username: null },
  };

  let viewerTokenBalance: number | null = null;
  let viewerHasStarred = false;
  let viewerGivenProps = 0;

  if (currentUserId) {
    const [balanceResult, { data: star }, { data: giftRows }] =
      await Promise.all([
        ensureViewerPropsBalance(supabase, currentUserId),
        supabase
          .from("starred_threads")
          .select("user_id, thread_id")
          .eq("user_id", currentUserId)
          .eq("thread_id", id)
          .maybeSingle(),
        supabase
          .from("token_transactions")
          .select("amount")
          .eq("giver_id", currentUserId)
          .eq("thread_id", id),
      ]);

    viewerTokenBalance = balanceResult.balance;
    viewerHasStarred = Boolean(star);
    viewerGivenProps = (giftRows ?? []).reduce((sum, row) => {
      const amount =
        typeof row.amount === "number" && Number.isFinite(row.amount)
          ? Math.floor(row.amount)
          : 0;
      return sum + Math.max(0, amount);
    }, 0);
  }

  return {
    thread,
    isAuthenticated: Boolean(user),
    currentUserId,
    viewerTokenBalance,
    viewerHasStarred,
    viewerGivenProps,
  };
}
