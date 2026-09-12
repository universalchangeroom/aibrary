"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ThreadActions } from "@/components/feed/thread-actions";
import { ThreadDetailView } from "@/components/feed/thread-detail-view";
import { Button } from "@/components/ui/button";
import { normalizePropsTotal } from "@/lib/props-display";
import type { ThreadWithFootnotes } from "@/lib/types";

interface ThreadPageClientProps {
  thread: ThreadWithFootnotes;
  isAuthenticated: boolean;
  currentUserId: string | null;
  viewerTokenBalance: number | null;
  viewerHasStarred: boolean;
  /** Props this viewer has already given to this thread (Influence Cap). */
  viewerGivenProps?: number;
}

export function ThreadPageClient({
  thread,
  isAuthenticated,
  currentUserId,
  viewerTokenBalance,
  viewerHasStarred,
  viewerGivenProps = 0,
}: ThreadPageClientProps) {
  const serverPropsTotal = normalizePropsTotal(
    thread.props_count ?? thread.total_tokens
  );
  const serverSlopTotal =
    typeof thread.slop_count === "number" ? Math.max(0, thread.slop_count) : 0;
  const [displayedPropsTotal, setDisplayedPropsTotal] =
    useState(serverPropsTotal);
  const [displayedSlopTotal, setDisplayedSlopTotal] = useState(serverSlopTotal);

  useEffect(() => {
    setDisplayedPropsTotal(
      normalizePropsTotal(thread.props_count ?? thread.total_tokens)
    );
    setDisplayedSlopTotal(
      typeof thread.slop_count === "number" ? Math.max(0, thread.slop_count) : 0
    );
  }, [thread.id, thread.total_tokens, thread.props_count, thread.slop_count]);

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Button variant="ghost" size="sm" className="-ml-2 w-fit" asChild>
          <Link href="/feed">
            <ArrowLeft className="h-4 w-4" />
            Back to feed
          </Link>
        </Button>

        <ThreadActions
          key={`thread-actions-${thread.id}-${viewerTokenBalance ?? "none"}-${viewerHasStarred ? "1" : "0"}-${viewerGivenProps}`}
          threadId={thread.id}
          authorId={thread.author_id}
          currentUserId={currentUserId}
          tokenBalance={viewerTokenBalance}
          starred={viewerHasStarred}
          previouslyGivenProps={viewerGivenProps}
          propsCount={displayedPropsTotal}
          slopCount={displayedSlopTotal}
          onOptimisticPropsGive={(amount) => {
            setDisplayedPropsTotal((prev) => prev + amount);
          }}
          onOptimisticPropsRevert={(amount) => {
            setDisplayedPropsTotal((prev) => Math.max(0, prev - amount));
          }}
          onPropsTotalSync={(total) => {
            setDisplayedPropsTotal(normalizePropsTotal(total));
          }}
          onSlopCountSync={(total) => {
            setDisplayedSlopTotal(Math.max(0, total));
          }}
        />
      </div>

      <ThreadDetailView
        key={thread.id}
        thread={thread}
        isAuthenticated={isAuthenticated}
        displayedPropsTotal={displayedPropsTotal}
      />
    </>
  );
}
