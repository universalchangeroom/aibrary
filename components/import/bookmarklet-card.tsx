"use client";

import { useEffect, useState } from "react";

import { buildImportBookmarklet } from "@/lib/bookmarklet";
import { cn } from "@/lib/utils";

interface BookmarkletCardProps {
  className?: string;
}

/**
 * Draggable ChatShare bookmarklet install card.
 * Payload comes from buildImportBookmarklet (DeepSeek, Claude, Gemini scrapers).
 */
export function BookmarkletCard({ className }: BookmarkletCardProps) {
  const [appOrigin, setAppOrigin] = useState("");

  useEffect(() => {
    setAppOrigin(window.location.origin);
  }, []);

  const bookmarkletScript = appOrigin
    ? buildImportBookmarklet(appOrigin)
    : undefined;

  return (
    <div
      className={cn(
        "space-y-3 rounded-lg border border-indigo-200 bg-indigo-50/80 p-4 text-left shadow-sm dark:border-indigo-900/50 dark:bg-indigo-950/30",
        className
      )}
    >
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">
          ⚡ 1-Click Browser Bookmarklet
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Drag this button to your browser&apos;s Bookmarks Bar to import chats
          directly from DeepSeek, Claude, Gemini, or ChatGPT in one click:
        </p>
      </div>

      <a
        href={bookmarkletScript}
        draggable={Boolean(bookmarkletScript)}
        onClick={(e) => e.preventDefault()}
        className="inline-block cursor-grab rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-700 active:cursor-grabbing"
        title="Drag to your bookmarks bar, then open a DeepSeek, Claude, Gemini, or ChatGPT chat and click the bookmark"
      >
        + Import to ChatShare
      </a>

      <p className="text-xs text-muted-foreground">
        Then open a DeepSeek, Claude, Gemini, or ChatGPT conversation tab and
        click the bookmark (ChatShare must be running).
      </p>
    </div>
  );
}
