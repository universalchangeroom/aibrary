import ThreadCard, { type ThreadCardProps } from "@/components/ThreadCard";

export interface ConceptSwimlaneProps {
  categoryName: string;
  threads: ThreadCardProps[];
}

export function ConceptSwimlane({
  categoryName,
  threads,
}: ConceptSwimlaneProps) {
  const headingId = `swimlane-${categoryName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")}`;

  return (
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        className="mb-4 text-sm font-bold uppercase tracking-wider text-stone-500 dark:text-stone-400"
      >
        {categoryName}
      </h2>

      <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {threads.map((thread) => (
          <ThreadCard key={thread.id} {...thread} />
        ))}
      </div>
    </section>
  );
}

export default ConceptSwimlane;
