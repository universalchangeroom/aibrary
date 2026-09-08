import ConceptSwimlane from "@/components/ConceptSwimlane";
import type { ThreadCardProps } from "@/components/ThreadCard";
import {
  SHARE_SOURCE_MODELS,
  sourceModelDisplayName,
} from "@/lib/share-source-model";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient as createServerClient } from "@/lib/supabase/server";
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

function propsCount(row: PublicThreadRow): number {
  return typeof row.total_tokens === "number" ? row.total_tokens : 0;
}

function sortByProps(rows: PublicThreadRow[]): PublicThreadRow[] {
  return [...rows].sort((a, b) => propsCount(b) - propsCount(a));
}

function matchesKeywords(
  row: PublicThreadRow,
  keywords: readonly string[]
): boolean {
  const searchable = `${row.title} ${normalizedTags(row).join(" ")}`
    .toLowerCase();
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(searchable);
  });
}

function matchesModel(row: PublicThreadRow, pattern: RegExp): boolean {
  return pattern.test(row.source_model?.trim() || "");
}

function toThreadCards(
  rows: PublicThreadRow[],
  usernamesByAuthorId: ReadonlyMap<string, string>
): ThreadCardProps[] {
  return rows.map((row) => {
    const tags = normalizedTags(row);
    return {
      title: row.title,
      summary: row.summary?.trim() || plainTextExcerpt(row.content),
      modelName: modelDisplayName(row.source_model),
      authorUsername:
        usernamesByAuthorId.get(row.author_id)?.replace(/^@+/, "") ||
        "anonymous",
      propsCount: propsCount(row),
      primaryTag: tags[0] || "Uncategorized",
    };
  });
}

export default async function FeedPage() {
  const supabase = createPublicClient();
  const authSupabase = await createServerClient();
  const [{ data, error }, { data: sessionData }] = await Promise.all([
    supabase
      .from("threads")
      .select(
        "id, author_id, title, content, summary, source_model, tags, total_tokens, created_at"
      )
      .eq("is_public", true)
      .eq("status", "published")
      .order("created_at", { ascending: false }),
    authSupabase.auth.getSession(),
  ]);

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

  const currentUserId = sessionData.session?.user.id ?? null;
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1_000;
  const topOfTheProps = toThreadCards(
    sortByProps(rows).slice(0, 15),
    usernamesByAuthorId
  );
  const trending = toThreadCards(
    sortByProps(
      rows.filter(
        (row) => new Date(row.created_at).getTime() >= fourteenDaysAgo
      )
    ),
    usernamesByAuthorId
  );
  const everythingLove = toThreadCards(
    sortByProps(
      rows.filter((row) =>
        matchesKeywords(row, ["love", "relationship", "romance"])
      )
    ),
    usernamesByAuthorId
  );
  const everythingScience = toThreadCards(
    sortByProps(
      rows.filter((row) =>
        matchesKeywords(row, ["science", "gpus", "physics", "universe"])
      )
    ),
    usernamesByAuthorId
  );
  const historyOfEverything = toThreadCards(
    sortByProps(
      rows.filter((row) =>
        matchesKeywords(row, ["history", "ancient", "past", "empire"])
      )
    ),
    usernamesByAuthorId
  );
  const womenAndMen = toThreadCards(
    sortByProps(
      rows.filter((row) =>
        matchesKeywords(row, ["gender", "women", "men", "society"])
      )
    ),
    usernamesByAuthorId
  );
  const myStuff = currentUserId
    ? toThreadCards(
        sortByProps(rows.filter((row) => row.author_id === currentUserId)),
        usernamesByAuthorId
      )
    : [];

  const gemini = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /gemini/i))),
    usernamesByAuthorId
  );
  const grok = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /grok/i))),
    usernamesByAuthorId
  );
  const meta = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /llama|meta/i))),
    usernamesByAuthorId
  );
  const chatGpt = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /gpt|chatgpt/i))),
    usernamesByAuthorId
  );
  const deepSeek = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /deepseek/i))),
    usernamesByAuthorId
  );
  const claude = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /claude/i))),
    usernamesByAuthorId
  );
  const perplexity = toThreadCards(
    sortByProps(rows.filter((row) => matchesModel(row, /perplexity/i))),
    usernamesByAuthorId
  );
  const frontierModelPattern =
    /gemini|grok|llama|meta|gpt|chatgpt|deepseek|claude|perplexity/i;
  const openSourceAndOther = toThreadCards(
    sortByProps(
      rows.filter((row) => !matchesModel(row, frontierModelPattern))
    ),
    usernamesByAuthorId
  );

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

        {topOfTheProps.length > 0 ? (
          <div className="mt-12 space-y-12">
            {topOfTheProps.length > 0 && (
              <ConceptSwimlane
                categoryName="Top of the Props"
                threads={topOfTheProps}
              />
            )}
            {trending.length > 0 && (
              <ConceptSwimlane categoryName="Trending" threads={trending} />
            )}
            {everythingLove.length > 0 && (
              <ConceptSwimlane
                categoryName="Everything Love"
                threads={everythingLove}
              />
            )}
            {everythingScience.length > 0 && (
              <ConceptSwimlane
                categoryName="Everything Science"
                threads={everythingScience}
              />
            )}
            {historyOfEverything.length > 0 && (
              <ConceptSwimlane
                categoryName="History of Everything"
                threads={historyOfEverything}
              />
            )}
            {womenAndMen.length > 0 && (
              <ConceptSwimlane
                categoryName="Women & Men"
                threads={womenAndMen}
              />
            )}
            {currentUserId && myStuff.length > 0 && (
              <ConceptSwimlane categoryName="My Stuff" threads={myStuff} />
            )}
            {gemini.length > 0 && (
              <ConceptSwimlane categoryName="Gemini" threads={gemini} />
            )}
            {grok.length > 0 && (
              <ConceptSwimlane categoryName="Grok" threads={grok} />
            )}
            {meta.length > 0 && (
              <ConceptSwimlane categoryName="Meta" threads={meta} />
            )}
            {chatGpt.length > 0 && (
              <ConceptSwimlane categoryName="ChatGPT" threads={chatGpt} />
            )}
            {deepSeek.length > 0 && (
              <ConceptSwimlane categoryName="DeepSeek" threads={deepSeek} />
            )}
            {claude.length > 0 && (
              <ConceptSwimlane categoryName="Claude" threads={claude} />
            )}
            {perplexity.length > 0 && (
              <ConceptSwimlane
                categoryName="Perplexity"
                threads={perplexity}
              />
            )}
            {openSourceAndOther.length > 0 && (
              <ConceptSwimlane
                categoryName="Open Source / Other"
                threads={openSourceAndOther}
              />
            )}
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
