"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { TabThreadPanel } from "@/components/reader/tab-thread-panel";
import { useReaderTabs } from "@/components/reader/reader-tabs-provider";
import { FEED_TAB_ID } from "@/lib/reader-tabs";

/**
 * Discover shell: keep the feed mounted (hidden) while a transcript tab is active.
 * Feed chrome (gradients) stays inside `children` so it does not cover the reader.
 */
export function DiscoverWorkbench({ children }: { children: ReactNode }) {
  const { activeTabId } = useReaderTabs();
  const showFeed = activeTabId === FEED_TAB_ID;
  const feedRef = useRef<HTMLDivElement>(null);

  // Drop focus from the card link before aria-hiding the feed (a11y).
  useEffect(() => {
    if (showFeed) return;
    const root = feedRef.current;
    if (!root) return;
    const focused = root.querySelector(":focus") as HTMLElement | null;
    focused?.blur();
  }, [showFeed, activeTabId]);

  return (
    <>
      <div
        ref={feedRef}
        className={showFeed ? undefined : "hidden"}
        aria-hidden={showFeed ? undefined : true}
        inert={showFeed ? undefined : true}
      >
        {children}
      </div>
      {!showFeed ? (
        <div className="relative z-10 min-h-[calc(100vh-7rem)] bg-background text-foreground">
          <TabThreadPanel threadId={activeTabId} />
        </div>
      ) : null}
    </>
  );
}
