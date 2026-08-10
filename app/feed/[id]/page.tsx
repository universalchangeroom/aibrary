import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { ThreadDetailView } from "@/components/feed/thread-detail-view";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  type ThreadWithFootnotes,
} from "@/lib/types";
import { emptyVoteSummary, summarizeVotes, type VoteRow } from "@/lib/votes";

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
    .select("*, footnotes(*)")
    .eq("id", id)
    .order("created_at", { ascending: true, foreignTable: "footnotes" })
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load thread: ${error.message}`);
  }

  if (!data) {
    notFound();
  }

  const footnotes = asFootnotes(data.footnotes);
  const footnoteIds = footnotes.map((footnote) => footnote.id);

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
    content: asChatMessages(data.content),
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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
        <Link href="/feed">
          <ArrowLeft className="h-4 w-4" />
          Back to feed
        </Link>
      </Button>

      <ThreadDetailView
        thread={thread}
        isAuthenticated={Boolean(user)}
      />
    </main>
  );
}
