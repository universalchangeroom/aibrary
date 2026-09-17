"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  DEFAULT_READER_TABS_STATE,
  FEED_TAB_ID,
  MAX_OPEN_READER_TABS,
  READER_TABS_STORAGE_KEY,
  parseReaderTabsState,
  touchAccessOrder,
  type OpenTabInput,
  type ReaderTabsState,
} from "@/lib/reader-tabs";

export type ReaderTabsContextValue = ReaderTabsState & {
  openTab: (thread: OpenTabInput) => void;
  closeTab: (threadId: string) => void;
  setActiveTab: (tabId: string) => void;
};

const ReaderTabsContext = createContext<ReaderTabsContextValue | undefined>(
  undefined
);

function writeSession(state: ReaderTabsState) {
  try {
    window.sessionStorage.setItem(
      READER_TABS_STORAGE_KEY,
      JSON.stringify(state)
    );
  } catch {
    // Quota / private mode — ignore.
  }
}

/**
 * Session-persisted open-thread tabs for the Discover workbench.
 * Evicts the least-recently accessed tab when opening beyond {@link MAX_OPEN_READER_TABS}.
 */
export function ReaderTabsProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ReaderTabsState>(DEFAULT_READER_TABS_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(READER_TABS_STORAGE_KEY);
      setState(parseReaderTabsState(raw));
    } catch {
      setState({ ...DEFAULT_READER_TABS_STATE });
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    writeSession(state);
  }, [state, hydrated]);

  const openTab = useCallback((thread: OpenTabInput) => {
    const id = thread.id.trim();
    if (!id || id === FEED_TAB_ID) return;

    const title = thread.title.trim() || "Untitled";
    const model = thread.model.trim() || "Other";

    setState((current) => {
      const existing = current.openTabs.find((tab) => tab.id === id);
      if (existing) {
        return {
          ...current,
          openTabs: current.openTabs.map((tab) =>
            tab.id === id ? { id, title, model } : tab
          ),
          activeTabId: id,
          accessOrder: touchAccessOrder(current.accessOrder, id),
        };
      }

      let openTabs = [...current.openTabs];
      let accessOrder = [...current.accessOrder];

      if (openTabs.length >= MAX_OPEN_READER_TABS) {
        const evictId =
          accessOrder.find((candidate) =>
            openTabs.some((tab) => tab.id === candidate)
          ) ?? openTabs[0]?.id;

        if (evictId) {
          openTabs = openTabs.filter((tab) => tab.id !== evictId);
          accessOrder = accessOrder.filter((candidate) => candidate !== evictId);
        }
      }

      openTabs = [...openTabs, { id, title, model }];
      accessOrder = touchAccessOrder(accessOrder, id);

      return {
        openTabs,
        activeTabId: id,
        accessOrder,
      };
    });
  }, []);

  const closeTab = useCallback((threadId: string) => {
    const id = threadId.trim();
    if (!id || id === FEED_TAB_ID) return;

    setState((current) => {
      if (!current.openTabs.some((tab) => tab.id === id)) return current;

      const openTabs = current.openTabs.filter((tab) => tab.id !== id);
      const accessOrder = current.accessOrder.filter(
        (candidate) => candidate !== id
      );

      let activeTabId = current.activeTabId;
      if (current.activeTabId === id) {
        // Prefer the most recently accessed remaining tab; else Discover Feed.
        activeTabId = accessOrder.at(-1) ?? FEED_TAB_ID;
      }

      return { openTabs, activeTabId, accessOrder };
    });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    const id = tabId.trim() || FEED_TAB_ID;

    setState((current) => {
      if (id === FEED_TAB_ID) {
        return { ...current, activeTabId: FEED_TAB_ID };
      }
      if (!current.openTabs.some((tab) => tab.id === id)) return current;

      return {
        ...current,
        activeTabId: id,
        accessOrder: touchAccessOrder(current.accessOrder, id),
      };
    });
  }, []);

  const value = useMemo<ReaderTabsContextValue>(
    () => ({
      ...state,
      openTab,
      closeTab,
      setActiveTab,
    }),
    [state, openTab, closeTab, setActiveTab]
  );

  return (
    <ReaderTabsContext.Provider value={value}>
      {children}
    </ReaderTabsContext.Provider>
  );
}

export function useReaderTabs(): ReaderTabsContextValue {
  const ctx = useContext(ReaderTabsContext);
  if (!ctx) {
    throw new Error("useReaderTabs must be used within ReaderTabsProvider");
  }
  return ctx;
}
