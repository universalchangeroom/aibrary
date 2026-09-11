"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

export interface ThreadCardProps {
  id: string;
  title: string;
  summary: string;
  modelName: string;
  authorUsername: string;
  propsCount: number;
  primaryTag: string;
}

export function ThreadCard({
  id,
  title,
  summary,
  modelName,
  authorUsername,
  propsCount,
  primaryTag,
}: ThreadCardProps) {
  const router = useRouter();
  const username = authorUsername.replace(/^@+/, "");
  const tag = primaryTag.replace(/^#+/, "");

  function handleTagClick(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!tag) return;
    router.push(`/tags/${encodeURIComponent(tag)}`);
  }

  return (
    <Link
      href={`/feed/${id}`}
      aria-label={`Open ${title}`}
      className="flex w-80 min-w-[320px] snap-start flex-col rounded-xl border border-stone-200 border-t-2 border-t-orange-500/60 bg-stone-50 p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 focus-visible:ring-offset-2 dark:border-stone-700 dark:border-t-orange-400/70 dark:bg-slate-900"
    >
      <article className="flex h-full flex-1 flex-col">
        <div>
          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-amber-950/70 dark:text-amber-200">
            {modelName}
          </span>

          <h3 className="mt-4 line-clamp-2 font-serif text-xl font-bold leading-snug text-slate-900 dark:text-slate-100">
            {title}
          </h3>

          <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
            {summary}
          </p>
        </div>

        <footer className="mt-auto flex items-end justify-between gap-4 pt-6">
          <button
            type="button"
            onClick={handleTagClick}
            className="min-w-0 truncate rounded-md px-1.5 py-0.5 text-left text-sm text-orange-700 transition-colors hover:bg-amber-500/20 hover:cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 dark:text-orange-300"
            aria-label={`View chats tagged ${tag}`}
          >
            #{tag}
          </button>

          <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
            <span>@{username}</span>
            <span aria-label={`${propsCount} props`}>🎉 {propsCount}</span>
          </div>
        </footer>
      </article>
    </Link>
  );
}

export default ThreadCard;
