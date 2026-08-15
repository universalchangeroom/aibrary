"use client";

import { useEffect, useState } from "react";

import {
  buildImportBookmarklet,
  resolveChatShareOrigin,
} from "@/lib/bookmarklet";
import { cn } from "@/lib/utils";

interface BookmarkletCardProps {
  className?: string;
}

/**
 * Draggable ChatShare bookmarklet install card.
 * Payload copies labeled chat text to the clipboard (CSP-safe), then opens /share.
 */
export function BookmarkletCard({ className }: BookmarkletCardProps) {
  const [appOrigin, setAppOrigin] = useState(() => resolveChatShareOrigin());

  useEffect(() => {
    setAppOrigin(resolveChatShareOrigin(window.location.origin));
  }, []);

  const bookmarkletScript = buildImportBookmarklet(appOrigin);

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
          Drag this button to your browser&apos;s Bookmarks Bar. On Gemini,
          Claude, DeepSeek, or ChatGPT it copies the chat and opens ChatShare
          for paste (no cross-site fetch — works with strict CSPs):
        </p>
      </div>

      <a
        href={bookmarkletScript}
        draggable
        onClick={(e) => e.preventDefault()}
        className="inline-block cursor-grab rounded-md bg-indigo-600 px-4 py-2 font-medium text-white shadow hover:bg-indigo-700 active:cursor-grabbing"
        title="Drag to your bookmarks bar"
      >
        + Import to ChatShare
      </a>

      <p className="text-xs text-muted-foreground">
        Opens{" "}
        <span className="font-mono">
          {appOrigin}/share?paste=1
        </span>{" "}
        after copying. Re-drag the button if you change hosts or ports.
      </p>
    </div>
  );
}
