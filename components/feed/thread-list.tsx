import { EmptyThreadList } from "@/components/feed/empty-thread-list";
import { ThreadCard } from "@/components/feed/thread-card";
import type { ThreadWithFootnotes } from "@/lib/types";

interface ThreadListProps {
  threads?: ThreadWithFootnotes[] | null;
  variant?: "default" | "discover";
}

/**
 * Public Discover list. Always treats missing/null data as an empty array
 * so the page never crashes when there are no published threads.
 */
export function ThreadList({ threads, variant = "default" }: ThreadListProps) {
  const threadList = threads ?? [];

  if (threadList.length === 0) {
    return <EmptyThreadList variant={variant} />;
  }

  return (
    <section className="flex flex-col gap-4" aria-label="Thread feed">
      {threadList.map((thread) => (
        <ThreadCard key={thread.id} thread={thread} variant={variant} />
      ))}
    </section>
  );
}
