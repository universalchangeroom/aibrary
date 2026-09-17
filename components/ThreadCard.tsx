"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Flag, MoreHorizontal, ExternalLink } from "lucide-react";

import { MrSlopFace } from "@/components/MrSlopFace";
import { CuratorNotesDrawer } from "@/components/feed/curator-notes-drawer";
import { SourceModelIcon } from "@/components/feed/source-model-icon";
import { useReaderTabs } from "@/components/reader/reader-tabs-provider";
import { ReportThreadModal } from "@/components/ReportThreadModal";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/use-auth";
import type { MaxPropsEndorsementWithCurator } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface ThreadCardProps {
  id: string;
  title: string;
  /** Curator's personal note (stored in DB `summary`). */
  personalNote?: string | null;
  /** First user prompt for the card body + reading tooltip. */
  prompt: string;
  /** Display label for the model pill. */
  modelName: string;
  /** Raw stored source_model (used for logo mapping). */
  sourceModel?: string | null;
  /** Optional public share URL of the original AI conversation. */
  sourceUrl?: string | null;
  authorUsername: string;
  propsCount: number;
  slopCount: number;
  /** Max Props curator endorsements, oldest first. */
  maxPropsEndorsements?: MaxPropsEndorsementWithCurator[];
}

function usernameMonogram(username: string): string {
  const cleaned = username.trim().replace(/^@+/, "");
  if (!cleaned) return "?";
  return cleaned.slice(0, Math.min(2, cleaned.length)).toUpperCase();
}

/** Returns a safe http(s) URL string, or null if missing/invalid. */
function asHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

export function ThreadCard({
  id,
  title,
  personalNote,
  prompt,
  modelName,
  sourceModel,
  sourceUrl,
  authorUsername,
  propsCount,
  slopCount,
  maxPropsEndorsements: initialEndorsements = [],
}: ThreadCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { openTab } = useReaderTabs();
  const username = authorUsername.replace(/^@+/, "") || "anonymous";
  const note = personalNote?.trim() || "";
  const hasPersonalNote = note.length > 0;
  const modelIconKey = (sourceModel?.trim() || modelName).trim();
  const originalChatUrl = asHttpUrl(sourceUrl);

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [curatorDrawerOpen, setCuratorDrawerOpen] = useState(false);
  const [maxPropsEndorsements, setMaxPropsEndorsements] = useState(
    initialEndorsements
  );
  const menuRef = useRef<HTMLDivElement>(null);
  const hasMaxProps = maxPropsEndorsements.length > 0;

  useEffect(() => {
    setMaxPropsEndorsements(initialEndorsements);
  }, [initialEndorsements]);

  useEffect(() => {
    if (!menuOpen) return;

    function handlePointerDown(event: globalThis.MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  function handleMenuToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen((open) => !open);
  }

  function handleReportClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setMenuOpen(false);

    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/feed`)}`);
      return;
    }

    setReportOpen(true);
  }

  function handleMaxPropsBadgeClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setCuratorDrawerOpen(true);
  }

  function handleUsernameClick(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation();
  }

  function handleOpenInReader(event: MouseEvent<HTMLAnchorElement>) {
    // Allow modified clicks to use normal browser tab/window behavior.
    if (
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    ) {
      return;
    }

    event.preventDefault();
    openTab({
      id,
      title,
      model: modelIconKey || "Other",
    });
  }

  return (
    <>
      <article
        className={cn(
          "relative flex h-full min-h-[14rem] w-full flex-col rounded-2xl border border-white/20 bg-white/10 px-3 pb-3 pt-2 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-md transition-all",
          "hover:border-blue-400/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
        )}
      >
        <Link
          href={`/feed/${id}`}
          aria-label={`Open ${title}`}
          onClick={handleOpenInReader}
          className="absolute inset-0 z-0 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        />

        <div className="relative z-10 flex h-full flex-1 flex-col pointer-events-none">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <span className="inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
                <SourceModelIcon
                  sourceModel={modelIconKey}
                  className="h-3.5 w-3.5"
                />
                <span className="truncate">{modelName}</span>
              </span>

              {hasMaxProps ? (
                <button
                  type="button"
                  onClick={handleMaxPropsBadgeClick}
                  aria-label={`View ${maxPropsEndorsements.length} Max Props ${
                    maxPropsEndorsements.length === 1
                      ? "endorsement"
                      : "endorsements"
                  }`}
                  className={cn(
                    "pointer-events-auto inline-flex items-center gap-1 rounded-full border border-amber-400/55",
                    "bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-rose-600/25",
                    "px-2 py-0.5 font-serif text-[0.65rem] font-semibold tracking-[0.08em] text-amber-100",
                    "shadow-[0_0_14px_rgba(245,158,11,0.45),inset_0_0_0_1px_rgba(251,191,36,0.15)]",
                    "transition hover:border-amber-300/80 hover:from-amber-400/35 hover:via-orange-400/30 hover:to-rose-500/35",
                    "hover:shadow-[0_0_20px_rgba(244,63,94,0.4),0_0_12px_rgba(245,158,11,0.55)]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                  )}
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 rounded-full bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.95)]"
                  />
                  Max Props
                  {maxPropsEndorsements.length > 1 ? (
                    <span className="font-sans text-[0.6rem] font-medium tracking-normal text-amber-200/80">
                      ×{maxPropsEndorsements.length}
                    </span>
                  ) : null}
                </button>
              ) : null}
            </div>

            <div className="relative shrink-0 pointer-events-auto" ref={menuRef}>
              <button
                type="button"
                aria-label="Thread options"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                onClick={handleMenuToggle}
                className="rounded-full p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pink-400"
              >
                <MoreHorizontal className="h-5 w-5" />
              </button>

              {menuOpen ? (
                <div
                  role="menu"
                  className="absolute right-0 z-20 mt-1 min-w-[9.5rem] overflow-hidden rounded-xl border border-white/20 bg-slate-950/90 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.45)] backdrop-blur-xl"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleReportClick}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-white/85 transition-colors hover:bg-pink-500/15 hover:text-white"
                  >
                    <Flag className="h-3.5 w-3.5" aria-hidden />
                    Report
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <h3 className="mt-1.5 line-clamp-3 font-serif text-lg font-bold leading-tight tracking-tight text-amber-100 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]">
            {title}
          </h3>

          {hasPersonalNote ? (
            <p
              className={cn(
                "mt-1 line-clamp-2 font-serif text-xs italic leading-snug",
                "text-rose-300/90 drop-shadow-[0_0_8px_rgba(190,18,60,0.25)]"
              )}
            >
              {note}
            </p>
          ) : null}

          <Tooltip>
            <TooltipTrigger asChild>
              <p
                className={cn(
                  "pointer-events-auto mt-1 line-clamp-3 cursor-help text-xs leading-relaxed text-stone-200/90",
                  "outline-none focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-amber-400/60"
                )}
                tabIndex={0}
              >
                {prompt}
              </p>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="start"
              className={cn(
                "max-h-[min(60vh,24rem)] max-w-md overflow-y-auto border-amber-500/40",
                "bg-gradient-to-br from-stone-950 via-stone-900 to-amber-950/90 p-4",
                "font-serif text-sm leading-relaxed text-amber-50/95",
                "shadow-[0_0_24px_rgba(245,158,11,0.28),0_12px_32px_rgba(0,0,0,0.45)]",
                "break-words whitespace-pre-wrap"
              )}
            >
              {prompt}
            </TooltipContent>
          </Tooltip>

          <footer className="mt-auto flex items-end justify-between gap-2 pt-2.5">
            <div className="flex min-w-0 max-w-[55%] flex-col gap-0.5">
              <Link
                href={`/user/${encodeURIComponent(username)}`}
                onClick={handleUsernameClick}
                className={cn(
                  "pointer-events-auto inline-flex min-w-0 items-center gap-1.5 rounded-md px-0.5 py-0.5",
                  "text-xs font-medium text-white/85 transition-colors",
                  "hover:bg-white/10 hover:text-white",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                )}
                aria-label={`View @${username}'s profile`}
              >
                <span
                  className={cn(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    "border border-rose-400/35 bg-rose-500/20",
                    "font-serif text-[0.55rem] font-bold tracking-wide text-rose-100"
                  )}
                  aria-hidden
                >
                  {usernameMonogram(username)}
                </span>
                <span className="truncate">@{username}</span>
              </Link>

              {originalChatUrl ? (
                <a
                  href={originalChatUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className={cn(
                    "pointer-events-auto inline-flex max-w-full items-center gap-1 px-0.5",
                    "font-serif text-[0.65rem] italic leading-none tracking-wide",
                    "text-amber-200/55 underline-offset-2 transition-colors",
                    "hover:text-amber-100/80 hover:underline",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50"
                  )}
                >
                  <span className="truncate">Original Chat</span>
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
                </a>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-white/90">
              <span
                aria-label={`${propsCount} props`}
                className="inline-flex items-center gap-1"
              >
                🎉 {propsCount}
              </span>
              {slopCount > 0 ? (
                <span
                  aria-label={`${slopCount} slop`}
                  className="inline-flex items-center gap-1 text-lime-300"
                >
                  <MrSlopFace className="h-4 w-4" />
                  {slopCount}
                </span>
              ) : null}
            </div>
          </footer>
        </div>
      </article>

      <ReportThreadModal
        threadId={id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />

      <CuratorNotesDrawer
        open={curatorDrawerOpen}
        onOpenChange={setCuratorDrawerOpen}
        threadId={id}
        threadTitle={title}
        endorsements={maxPropsEndorsements}
        onEndorsementsChange={setMaxPropsEndorsements}
      />
    </>
  );
}

export default ThreadCard;
