"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import {
  DiscoverBackdrop,
  ExpandedThreadCard,
} from "@/components/feed/discover-surface";
import { ThreadActions } from "@/components/feed/thread-actions";
import { ThreadDetailView } from "@/components/feed/thread-detail-view";
import { useReaderTabs } from "@/components/reader/reader-tabs-provider";
import { Button } from "@/components/ui/button";
import { FEED_TAB_ID } from "@/lib/reader-tabs";
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
  const { setActiveTab } = useReaderTabs();
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
    <DiscoverBackdrop className="min-h-[calc(100vh-7rem)]">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 w-fit text-white/80 hover:bg-white/10 hover:text-white"
            type="button"
            onClick={() => setActiveTab(FEED_TAB_ID)}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to feed
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

        <ExpandedThreadCard>
          <ThreadDetailView
            key={thread.id}
            thread={thread}
            isAuthenticated={isAuthenticated}
            displayedPropsTotal={displayedPropsTotal}
            surface="glass"
          />
        </ExpandedThreadCard>
      </div>
    </DiscoverBackdrop>
  );
}
