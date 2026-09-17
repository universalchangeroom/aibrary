"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";

import { useReaderTabs } from "@/components/reader/reader-tabs-provider";
import { FEED_TAB_ID } from "@/lib/reader-tabs";

function pathForTab(tabId: string): string {
  return tabId === FEED_TAB_ID ? "/feed" : `/feed/${tabId}`;
}

function tabIdFromPath(pathname: string): string | null {
  if (pathname === "/feed") return FEED_TAB_ID;
  const match = pathname.match(/^\/feed\/([^/]+)\/?$/);
  return match?.[1] ?? null;
}

/**
 * Keeps `activeTabId` and the address bar in sync.
 * Soft `history.pushState` while the Discover page stays mounted; Next
 * `router.replace('/feed')` when leaving an SSR deep-link thread route.
 */
export function ReaderTabsUrlSync() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeTabId, openTabs, setActiveTab, openTab } = useReaderTabs();
  const ignorePopRef = useRef(false);

  // Align store ← URL when Next.js actually navigates (or on deep-link load).
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Prefer the address bar: soft pushState can differ from usePathname().
    const locationPath = window.location.pathname;
    const fromLocation = tabIdFromPath(locationPath);
    const fromNext = tabIdFromPath(pathname);

    if (fromLocation == null && fromNext == null) return;

    // Soft-tabbing on Discover: Next still reports `/feed` while the bar shows `/feed/:id`.
    if (pathname === "/feed" && fromLocation && fromLocation !== FEED_TAB_ID) {
      const existing = openTabs.find((tab) => tab.id === fromLocation);
      if (existing) {
        if (activeTabId !== fromLocation) setActiveTab(fromLocation);
      } else {
        openTab({
          id: fromLocation,
          title: "Conversation",
          model: "Other",
        });
      }
      return;
    }

    // True Discover URL in the address bar → Feed tab.
    if (locationPath === "/feed") {
      if (activeTabId !== FEED_TAB_ID) setActiveTab(FEED_TAB_ID);
      return;
    }

    // SSR `/feed/[id]` (or matching location).
    const threadId = fromLocation ?? fromNext;
    if (!threadId || threadId === FEED_TAB_ID) return;

    const existing = openTabs.find((tab) => tab.id === threadId);
    if (existing) {
      if (activeTabId !== threadId) setActiveTab(threadId);
    } else {
      openTab({ id: threadId, title: "Conversation", model: "Other" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- path-driven sync only
  }, [pathname]);

  // Align URL ← store when the active tab changes.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const nextPath = pathForTab(activeTabId);
    if (window.location.pathname === nextPath) return;

    if (
      activeTabId === FEED_TAB_ID &&
      pathname.startsWith("/feed/") &&
      pathname !== "/feed"
    ) {
      ignorePopRef.current = true;
      router.replace("/feed", { scroll: false });
      return;
    }

    if (pathname === "/feed") {
      ignorePopRef.current = true;
      window.history.pushState(
        { chatshareReaderTab: activeTabId },
        "",
        nextPath
      );
      return;
    }

    if (pathname.startsWith("/feed/")) {
      ignorePopRef.current = true;
      window.history.replaceState(
        { chatshareReaderTab: activeTabId },
        "",
        nextPath
      );
    }
  }, [activeTabId, pathname, router]);

  useEffect(() => {
    function onPopState() {
      if (ignorePopRef.current) {
        ignorePopRef.current = false;
        return;
      }

      const fromPath = tabIdFromPath(window.location.pathname);
      if (fromPath == null) return;

      if (fromPath === FEED_TAB_ID) {
        setActiveTab(FEED_TAB_ID);
        if (pathname !== "/feed") {
          router.replace("/feed", { scroll: false });
        }
        return;
      }

      const existing = openTabs.find((tab) => tab.id === fromPath);
      if (existing) setActiveTab(fromPath);
      else openTab({ id: fromPath, title: "Conversation", model: "Other" });
    }

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [openTabs, openTab, pathname, router, setActiveTab]);

  return null;
}
