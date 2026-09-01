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
}

export function ThreadPageClient({
  thread,
  isAuthenticated,
  currentUserId,
  viewerTokenBalance,
  viewerHasStarred,
}: ThreadPageClientProps) {
  const serverPropsTotal = normalizePropsTotal(thread.total_tokens);
  const [displayedPropsTotal, setDisplayedPropsTotal] =
    useState(serverPropsTotal);

  useEffect(() => {
    setDisplayedPropsTotal(normalizePropsTotal(thread.total_tokens));
  }, [thread.id, thread.total_tokens]);

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
          key={`thread-actions-${thread.id}-${viewerTokenBalance ?? "none"}-${viewerHasStarred ? "1" : "0"}`}
          threadId={thread.id}
          authorId={thread.author_id}
          currentUserId={currentUserId}
          tokenBalance={viewerTokenBalance}
          starred={viewerHasStarred}
          onOptimisticPropsGive={(amount) => {
            setDisplayedPropsTotal((prev) => prev + amount);
          }}
          onOptimisticPropsRevert={(amount) => {
            setDisplayedPropsTotal((prev) => Math.max(0, prev - amount));
          }}
          onPropsTotalSync={(total) => {
            setDisplayedPropsTotal(normalizePropsTotal(total));
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
