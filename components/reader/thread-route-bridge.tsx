"use client";

import { useEffect, type ReactNode } from "react";

import { TabThreadPanel } from "@/components/reader/tab-thread-panel";
import { useReaderTabs } from "@/components/reader/reader-tabs-provider";
import { FEED_TAB_ID } from "@/lib/reader-tabs";

type ThreadRouteBridgeProps = {
  threadId: string;
  title: string;
  model: string;
  children: ReactNode;
};

/**
 * Deep-link / refresh entry for `/feed/[id]`: registers the tab and swaps to
 * another tab's client panel when the strip selection changes.
 */
export function ThreadRouteBridge({
  threadId,
  title,
  model,
  children,
}: ThreadRouteBridgeProps) {
  const { activeTabId, openTab } = useReaderTabs();

  useEffect(() => {
    openTab({ id: threadId, title, model });
  }, [threadId, title, model, openTab]);

  if (activeTabId === FEED_TAB_ID) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-sm text-stone-500">
        Returning to Discover…
      </div>
    );
  }

  if (activeTabId !== threadId) {
    return <TabThreadPanel threadId={activeTabId} />;
  }

  return <>{children}</>;
}
