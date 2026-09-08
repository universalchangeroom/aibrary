export interface ThreadCardProps {
  title: string;
  summary: string;
  modelName: string;
  authorUsername: string;
  propsCount: number;
  primaryTag: string;
}

export function ThreadCard({
  title,
  summary,
  modelName,
  authorUsername,
  propsCount,
  primaryTag,
}: ThreadCardProps) {
  const username = authorUsername.replace(/^@+/, "");
  const tag = primaryTag.replace(/^#+/, "");

  return (
    <article className="flex min-w-[320px] w-80 snap-start flex-col rounded-xl border border-stone-200 border-t-2 border-t-orange-500/60 bg-stone-50 p-5 shadow-sm transition duration-200 ease-out hover:-translate-y-1 hover:cursor-pointer hover:shadow-md dark:border-stone-700 dark:border-t-orange-400/70 dark:bg-slate-900">
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
        <span className="min-w-0 truncate text-sm text-orange-700 dark:text-orange-300">
          #{tag}
        </span>

        <div className="flex shrink-0 items-center gap-2 text-sm font-medium text-stone-700 dark:text-stone-300">
          <span>@{username}</span>
          <span aria-label={`${propsCount} props`}>🎉 {propsCount}</span>
        </div>
      </footer>
    </article>
  );
}

export default ThreadCard;
