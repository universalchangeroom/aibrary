"use client";

import { usePathname } from "next/navigation";

import { ReaderTabsUrlSync } from "@/components/reader/reader-tabs-url-sync";
import { TabStrip } from "@/components/reader/tab-strip";

/**
 * Shows the Tabbed Reader Bar on Discover / thread routes.
 */
export function ReaderWorkbenchChrome() {
  const pathname = usePathname();
  const onFeedWorkbench =
    pathname === "/feed" || pathname.startsWith("/feed/");

  if (!onFeedWorkbench) return null;

  return (
    <>
      <ReaderTabsUrlSync />
      <TabStrip />
    </>
  );
}
