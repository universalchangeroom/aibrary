"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import { Flag, MoreHorizontal } from "lucide-react";

import { MrSlopFace } from "@/components/MrSlopFace";
import { HandMeter } from "@/components/HandMeter";
import { ReportThreadModal } from "@/components/ReportThreadModal";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

export interface ThreadCardProps {
  id: string;
  title: string;
  summary: string;
  modelName: string;
  authorUsername: string;
  propsCount: number;
  slopCount: number;
  primaryTag: string;
}

export function ThreadCard({
  id,
  title,
  summary,
  modelName,
  authorUsername,
  propsCount,
  slopCount,
  primaryTag,
}: ThreadCardProps) {
  const router = useRouter();
  const { user } = useAuth();
  const username = authorUsername.replace(/^@+/, "");
  const tag = primaryTag.replace(/^#+/, "");

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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

  function handleTagClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!tag) return;
    router.push(`/tags/${encodeURIComponent(tag)}`);
  }

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

  return (
    <>
      <article
        className={cn(
          "relative flex h-full w-full flex-col rounded-3xl border border-white/20 bg-white/10 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-md transition-all",
          "hover:border-blue-400/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.5)]"
        )}
      >
        <Link
          href={`/feed/${id}`}
          aria-label={`Open ${title}`}
          className="absolute inset-0 z-0 rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        />

        <div className="relative z-10 flex h-full flex-1 flex-col pointer-events-none">
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)]">
              {modelName}
            </span>

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

          <h3 className="mt-4 line-clamp-2 font-serif text-xl font-bold leading-snug text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.25)] sm:text-2xl">
            {title}
          </h3>

          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-200/85">
            {summary}
          </p>

          <footer className="mt-auto flex items-end justify-between gap-4 pt-6">
            <button
              type="button"
              onClick={handleTagClick}
              className="pointer-events-auto min-w-0 truncate rounded-md px-1.5 py-0.5 text-left text-sm font-semibold text-yellow-300 transition-colors hover:cursor-pointer hover:bg-yellow-400/20 hover:text-yellow-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
              aria-label={`View chats tagged ${tag}`}
            >
              #{tag}
            </button>

            <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-white/90">
              <span>@{username}</span>
              <HandMeter
                propsCount={propsCount}
                slopCount={slopCount}
                size="sm"
              />
              <span
                aria-label={`${propsCount} props`}
                className="inline-flex items-center gap-1"
              >
                🎉 {propsCount}
              </span>
              <span
                aria-label={`${slopCount} slop`}
                className={cn(
                  "inline-flex items-center gap-1",
                  slopCount === 0 ? "opacity-40" : "text-lime-300"
                )}
              >
                <MrSlopFace className="h-4 w-4" />
                {slopCount}
              </span>
            </div>
          </footer>
        </div>
      </article>

      <ReportThreadModal
        threadId={id}
        open={reportOpen}
        onOpenChange={setReportOpen}
      />
    </>
  );
}

export default ThreadCard;
