"use client";

import { X } from "lucide-react";

import { SourceModelIcon } from "@/components/feed/source-model-icon";
import { useReaderTabs } from "@/components/reader/reader-tabs-provider";
import { FEED_TAB_ID, truncateTabTitle } from "@/lib/reader-tabs";
import { cn } from "@/lib/utils";

/**
 * Fixed sub-header tab strip for the Discover workbench.
 * Visual + store wiring only — does not swap thread views yet.
 */
export function TabStrip({ className }: { className?: string }) {
  const { openTabs, activeTabId, setActiveTab, closeTab } = useReaderTabs();
  const feedActive = activeTabId === FEED_TAB_ID;

  return (
    <div
      className={cn(
        "sticky top-14 z-30 border-b border-amber-200/70 bg-gradient-to-r from-stone-50 via-amber-50/80 to-orange-50/60 backdrop-blur supports-[backdrop-filter]:bg-stone-50/90",
        className
      )}
      role="navigation"
      aria-label="Open transcripts"
    >
      <div className="mx-auto flex w-full max-w-5xl items-stretch gap-1 px-3 sm:px-6">
        <button
          type="button"
          onClick={() => setActiveTab(FEED_TAB_ID)}
          className={cn(
            "relative shrink-0 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
            feedActive
              ? "border-amber-500 text-amber-950"
              : "border-transparent text-stone-500 hover:border-amber-300/60 hover:text-stone-800"
          )}
          aria-current={feedActive ? "page" : undefined}
        >
          Discover Feed
        </button>

        <div
          className={cn(
            "flex min-w-0 flex-1 items-stretch gap-0.5 overflow-x-auto",
            "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
          )}
        >
          {openTabs.map((tab) => {
            const active = activeTabId === tab.id;
            const label = truncateTabTitle(tab.title);

            return (
              <div
                key={tab.id}
                className={cn(
                  "group relative flex max-w-[14rem] shrink-0 items-center gap-1.5 border-b-2 px-2 py-1.5 transition-colors",
                  active
                    ? "border-amber-500 bg-amber-100/50 text-amber-950"
                    : "border-transparent text-stone-500 hover:bg-amber-50/70 hover:text-stone-800"
                )}
              >
                <button
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                  title={tab.title}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center justify-center rounded-md border px-1 py-0.5",
                      active
                        ? "border-amber-400/70 bg-white/80"
                        : "border-stone-200/80 bg-white/60"
                    )}
                    aria-hidden
                  >
                    <SourceModelIcon
                      sourceModel={tab.model}
                      className="h-3.5 w-3.5"
                    />
                  </span>
                  <span className="truncate text-sm font-medium">{label}</span>
                </button>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(tab.id);
                  }}
                  className={cn(
                    "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-stone-400 transition",
                    "hover:bg-amber-200/60 hover:text-amber-950",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/70",
                    active ? "opacity-100" : "opacity-70 group-hover:opacity-100"
                  )}
                  aria-label={`Close tab: ${tab.title}`}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
