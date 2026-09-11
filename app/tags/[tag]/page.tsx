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
        typeof row.total_tokens === "number" ? row.total_tokens : 0,
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
      "id, author_id, title, content, summary, source_model, tags, total_tokens, created_at"
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

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 text-stone-800">
      <main className="mx-auto w-full max-w-7xl px-6 py-16">
        <header className="space-y-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-400/10 to-transparent px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            # {decodedTag || "untagged"}
          </h1>
          <p className="text-stone-600">Showing published chats</p>
        </header>

        {error ? (
          <div className="mt-12 rounded-xl border border-dashed border-orange-200 bg-white/60 px-6 py-12 text-center text-stone-600">
            Tag results are temporarily unavailable.
          </div>
        ) : threads.length > 0 ? (
          <div className="mt-12 flex flex-wrap gap-6">
            {threads.map((thread) => (
              <ThreadCard key={thread.id} {...thread} />
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-xl border border-dashed border-orange-200 bg-white/60 px-6 py-12 text-center text-stone-600">
            No chats found bearing this tag.
          </div>
        )}
      </main>
    </div>
  );
}
