import ThreadCard, { type ThreadCardProps } from "@/components/ThreadCard";
import {
  SHARE_SOURCE_MODELS,
  sourceModelDisplayName,
} from "@/lib/share-source-model";
import { createPublicClient } from "@/lib/supabase/public";
import { asChatMessages } from "@/lib/types";

/** Tag results: Incremental Static Regeneration every 60 seconds. */
export const revalidate = 60;

type PublicThreadRow = {
  id: string;
  author_id: string;
  title: string;
  content: unknown;
  summary: string | null;
  source_model: string | null;
  tags: unknown;
  total_tokens: number | null;
  props_count: number | null;
  slop_count: number | null;
  created_at: string;
};

function plainTextExcerpt(content: unknown): string {
  const messages = asChatMessages(content);
  const source =
    messages.find((message) => message.role === "assistant")?.content ??
    messages[0]?.content ??
    "";
  const plain = source
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`#>*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "Open this conversation to read the full exchange.";
  return plain.length > 240 ? `${plain.slice(0, 237).trimEnd()}…` : plain;
}

function modelDisplayName(value: string | null): string {
  const model = value?.trim();
  if (!model) return "Other";
  const isPlatformFamily = (SHARE_SOURCE_MODELS as readonly string[]).includes(
    model.toLowerCase()
  );
  return isPlatformFamily ? sourceModelDisplayName(model) : model;
}

function normalizedTags(row: PublicThreadRow): string[] {
  return Array.isArray(row.tags)
    ? row.tags
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().replace(/^#+/, ""))
        .filter(Boolean)
    : [];
}

function toThreadCards(
  rows: PublicThreadRow[],
  usernamesByAuthorId: ReadonlyMap<string, string>,
  preferredTag: string
): ThreadCardProps[] {
  return rows.map((row) => {
    const tags = normalizedTags(row);
    const matchingTag =
      tags.find(
        (tag) => tag.toLowerCase() === preferredTag.toLowerCase()
      ) ?? tags[0];

    return {
      id: row.id,
      title: row.title,
      summary: row.summary?.trim() || plainTextExcerpt(row.content),
      modelName: modelDisplayName(row.source_model),
      authorUsername:
        usernamesByAuthorId.get(row.author_id)?.replace(/^@+/, "") ||
        "anonymous",
      propsCount:
        typeof row.props_count === "number"
          ? row.props_count
          : typeof row.total_tokens === "number"
            ? row.total_tokens
            : 0,
      slopCount: typeof row.slop_count === "number" ? row.slop_count : 0,
      primaryTag: matchingTag || preferredTag || "Uncategorized",
    };
  });
}

export default async function TagResultsPage({
  params,
}: {
  params: Promise<{ tag: string }> | { tag: string };
}) {
  const { tag: rawTag } = await Promise.resolve(params);
  const decodedTag = decodeURIComponent(rawTag ?? "")
    .trim()
    .replace(/^#+/, "");

  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, summary, source_model, tags, total_tokens, props_count, slop_count, created_at"
    )
    .eq("is_public", true)
    .eq("status", "published")
    .contains("tags", [decodedTag])
    .order("created_at", { ascending: false });

  const rows =
    !error && Array.isArray(data) ? (data as unknown as PublicThreadRow[]) : [];
  const authorIds = Array.from(
    new Set(rows.map((row) => row.author_id).filter(Boolean))
  );
  const usernamesByAuthorId = new Map<string, string>();

  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", authorIds);

    for (const profile of profiles ?? []) {
      if (
        typeof profile.id === "string" &&
        typeof profile.username === "string" &&
        profile.username.trim()
      ) {
        usernamesByAuthorId.set(
          profile.id,
          profile.username.trim().replace(/^@+/, "")
        );
      }
    }
  }

  const threads = toThreadCards(rows, usernamesByAuthorId, decodedTag);
  const displayTag = decodedTag || "untagged";
  const transcriptLabel =
    threads.length === 1 ? "transcript" : "transcripts";

  return (
    <div className="relative min-h-[calc(100vh-3.5rem)] overflow-hidden bg-slate-950 text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-950"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 top-16 h-64 w-64 rounded-full bg-blue-500/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-0 top-24 h-72 w-72 rounded-full bg-fuchsia-500/15 blur-3xl"
      />

      <main className="relative z-10 mx-auto w-full max-w-7xl px-6 py-16">
        <header className="space-y-3 border-b border-white/15 pb-6">
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="font-medium text-slate-400">Context:</span>{" "}
            <span className="text-white">{displayTag}</span>
          </h1>
          <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-medium tracking-wide text-cyan-200">
            {threads.length} {transcriptLabel}
          </p>
        </header>

        {error ? (
          <div className="mt-10 rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300">
            Tag results are temporarily unavailable.
          </div>
        ) : threads.length > 0 ? (
          <div className="mt-10 flex flex-wrap gap-6">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} {...thread} />
            ))}
          </div>
        ) : (
          <div className="mt-10 rounded-xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300">
            No chats found bearing this tag.
          </div>
        )}
      </main>
    </div>
  );
}
