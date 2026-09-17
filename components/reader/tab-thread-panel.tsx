"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ThreadPageClient } from "@/components/feed/thread-page-client";
import {
  getReaderThread,
  type ReaderThreadPayload,
} from "@/lib/actions/reader-thread";

/**
 * Client-fetched transcript panel for an active reader tab.
 */
export function TabThreadPanel({ threadId }: { threadId: string }) {
  const [payload, setPayload] = useState<ReaderThreadPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setPayload(null);

    void (async () => {
      try {
        const next = await getReaderThread(threadId);
        if (cancelled) return;
        if (!next) {
          setError("This conversation could not be loaded.");
          setPayload(null);
        } else {
          setPayload(next);
        }
      } catch (cause) {
        if (cancelled) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "This conversation could not be loaded."
        );
        setPayload(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [threadId]);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-sm text-stone-500">
        <Loader2 className="h-5 w-5 animate-spin text-amber-600" aria-hidden />
        Loading conversation…
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error ?? "This conversation could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-6 py-12">
      <ThreadPageClient
        key={payload.thread.id}
        thread={payload.thread}
        isAuthenticated={payload.isAuthenticated}
        currentUserId={payload.currentUserId}
        viewerTokenBalance={payload.viewerTokenBalance}
        viewerHasStarred={payload.viewerHasStarred}
        viewerGivenProps={payload.viewerGivenProps}
      />
    </main>
  );
}
