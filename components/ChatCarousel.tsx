"use client";

import ThreadCard, { type ThreadCardProps } from "@/components/ThreadCard";

interface ChatCarouselProps {
  threads: ThreadCardProps[];
  errorMessage?: string | null;
}

/** Discover feed grid (legacy export name kept for import stability). */
export function ChatCarousel({ threads, errorMessage }: ChatCarouselProps) {
  const hasThreads = threads.length > 0;

  return (
    <div className="w-full px-6 py-10">
      {errorMessage ? (
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300 backdrop-blur-md">
            {errorMessage}
          </div>
        </div>
      ) : hasThreads ? (
        <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {threads.map((thread) => (
            <ThreadCard key={thread.id} {...thread} />
          ))}
        </div>
      ) : (
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300 backdrop-blur-md">
            No published conversations yet. Share the first one.
          </div>
        </div>
      )}
    </div>
  );
}

export default ChatCarousel;
