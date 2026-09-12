import ThreadCard, { type ThreadCardProps } from "@/components/ThreadCard";
import { cn } from "@/lib/utils";

export interface ConceptSwimlaneProps {
  categoryName: string;
  threads: ThreadCardProps[];
  className?: string;
}

export function ConceptSwimlane({
  categoryName,
  threads,
  className,
}: ConceptSwimlaneProps) {
  if (threads.length === 0) return null;

  const headingId = `swimlane-${categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

  return (
    <section aria-labelledby={headingId} className={cn("w-full", className)}>
      <h2
        id={headingId}
        className="mb-4 px-6 text-sm font-bold uppercase tracking-wider text-white/70 sm:px-8"
      >
        {categoryName}
      </h2>

      <div className="flex flex-row gap-6 overflow-x-auto overflow-y-hidden pb-6 snap-x [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {threads.map((thread) => (
          <div
            key={thread.id}
            className="w-[350px] min-w-[320px] shrink-0 snap-start"
          >
            <ThreadCard {...thread} />
          </div>
        ))}
      </div>
    </section>
  );
}

export default ConceptSwimlane;
