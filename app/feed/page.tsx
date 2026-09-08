import ConceptSwimlane, {
  type ConceptSwimlaneProps,
} from "@/components/ConceptSwimlane";
import type { ThreadCardProps } from "@/components/ThreadCard";
import {
  SHARE_SOURCE_MODELS,
  sourceModelDisplayName,
} from "@/lib/share-source-model";
import { createPublicClient } from "@/lib/supabase/public";
import { asChatMessages } from "@/lib/types";

/** Discover feed: Incremental Static Regeneration every 60 seconds. */
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

/** Assign each published thread to its first tag (the primary concept). */
function groupThreadsByPrimaryTag(
  rows: PublicThreadRow[],
  usernamesByAuthorId: ReadonlyMap<string, string> = new Map()
): ConceptSwimlaneProps[] {
  const groups = new Map<string, ConceptSwimlaneProps>();

  for (const row of rows) {
    const tags = Array.isArray(row.tags)
      ? row.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim().replace(/^#+/, ""))
          .filter(Boolean)
      : [];
    const primaryTag = tags[0] || "Uncategorized";
    const groupKey = primaryTag.toLocaleLowerCase();
    const thread: ThreadCardProps = {
      title: row.title,
      summary: row.summary?.trim() || plainTextExcerpt(row.content),
      modelName: modelDisplayName(row.source_model),
      authorUsername:
        usernamesByAuthorId.get(row.author_id)?.replace(/^@+/, "") ||
        "anonymous",
      propsCount:
        typeof row.total_tokens === "number" ? row.total_tokens : 0,
      primaryTag,
    };
    const group = groups.get(groupKey);

    if (group) {
      group.threads.push(thread);
    } else {
      groups.set(groupKey, {
        categoryName: primaryTag,
        threads: [thread],
      });
    }
  }

  return Array.from(groups.values()).filter(
    (category) => category.threads.length > 0
  );
}

export default async function FeedPage() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, summary, source_model, tags, total_tokens"
    )
    .eq("is_public", true)
    .eq("status", "published")
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
        usernamesByAuthorId.set(profile.id, profile.username.trim());
      }
    }
  }

  const categories = groupThreadsByPrimaryTag(rows, usernamesByAuthorId);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 text-stone-800">
      <main className="mx-auto w-full max-w-7xl px-6 py-16">
        <header className="space-y-2 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-400/10 to-transparent px-4 py-6">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            Discover
          </h1>
          <p className="text-stone-600">
            Browse shared AI conversations from the ChatShare community.
          </p>
        </header>

        {categories.length > 0 ? (
          <div className="mt-12 space-y-12">
            {categories.map((category) => (
              <ConceptSwimlane
                key={category.categoryName}
                categoryName={category.categoryName}
                threads={category.threads}
              />
            ))}
          </div>
        ) : (
          <div className="mt-12 rounded-xl border border-dashed border-orange-200 bg-white/60 px-6 py-12 text-center text-stone-600">
            {error
              ? "The Discover feed is temporarily unavailable."
              : "No published conversations yet. Share the first one."}
          </div>
        )}
      </main>
    </div>
  );
}
