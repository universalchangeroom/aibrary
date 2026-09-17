/**
 * Tabbed Reader Bar — types & persistence helpers (session-scoped).
 * Max 6 open thread tabs; Discover Feed uses a dedicated sentinel id.
 */

export const FEED_TAB_ID = "feed" as const;

export const MAX_OPEN_READER_TABS = 6;

export const READER_TABS_STORAGE_KEY = "chatshare_reader_tabs_v1";

export type ReaderTab = {
  id: string;
  title: string;
  model: string;
};

export type ReaderTabsState = {
  openTabs: ReaderTab[];
  /** `FEED_TAB_ID` for Discover Feed, otherwise a thread id. */
  activeTabId: string;
  /** Least-recent → most-recent thread ids (LRU eviction reads from the front). */
  accessOrder: string[];
};

export type OpenTabInput = {
  id: string;
  title: string;
  model: string;
};

export const DEFAULT_READER_TABS_STATE: ReaderTabsState = {
  openTabs: [],
  activeTabId: FEED_TAB_ID,
  accessOrder: [],
};

function isReaderTab(value: unknown): value is ReaderTab {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.title === "string" &&
    typeof row.model === "string"
  );
}

export function parseReaderTabsState(raw: string | null): ReaderTabsState {
  if (!raw) return { ...DEFAULT_READER_TABS_STATE };

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { ...DEFAULT_READER_TABS_STATE };
    }

    const record = parsed as Record<string, unknown>;
    const openTabs = Array.isArray(record.openTabs)
      ? record.openTabs.filter(isReaderTab).slice(0, MAX_OPEN_READER_TABS)
      : [];

    const openIds = new Set(openTabs.map((tab) => tab.id));
    const accessOrder = Array.isArray(record.accessOrder)
      ? record.accessOrder.filter(
          (id): id is string => typeof id === "string" && openIds.has(id)
        )
      : openTabs.map((tab) => tab.id);

    // Ensure every open tab appears in accessOrder (append missing as most recent).
    for (const tab of openTabs) {
      if (!accessOrder.includes(tab.id)) accessOrder.push(tab.id);
    }

    const activeRaw =
      typeof record.activeTabId === "string" ? record.activeTabId : FEED_TAB_ID;
    const activeTabId =
      activeRaw === FEED_TAB_ID || openIds.has(activeRaw)
        ? activeRaw
        : FEED_TAB_ID;

    return { openTabs, activeTabId, accessOrder };
  } catch {
    return { ...DEFAULT_READER_TABS_STATE };
  }
}

export function touchAccessOrder(
  accessOrder: string[],
  threadId: string
): string[] {
  return [...accessOrder.filter((id) => id !== threadId), threadId];
}

export function truncateTabTitle(title: string, maxChars = 22): string {
  const trimmed = title.trim() || "Untitled";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`;
}
