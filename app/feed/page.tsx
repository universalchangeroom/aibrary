import { ConceptSwimlane } from "@/components/ConceptSwimlane";
import type { ThreadCardProps } from "@/components/ThreadCard";
import { DiscoverWorkbench } from "@/components/reader/discover-workbench";
import {
  SHARE_SOURCE_MODELS,
  sourceModelDisplayName,
} from "@/lib/share-source-model";
import { createClient } from "@/lib/supabase/server";
import { asChatMessages, type MaxPropsEndorsementWithCurator } from "@/lib/types";

export const dynamic = "force-dynamic";

type EndorsementRow = {
  id: string;
  thread_id: string;
  user_id: string;
  comment: string | null;
  created_at: string;
  updated_at: string;
};

type PublicThreadRow = {
  id: string;
  author_id: string;
  title: string;
  content: unknown;
  summary: string | null;
  source_model: string | null;
  source_url: string | null;
  tags: unknown;
  total_tokens: number | null;
  props_count: number | null;
  slop_count: number | null;
  created_at: string;
  max_props_endorsements?: EndorsementRow[] | null;
};

/** Card props plus fields needed for swimlane taxonomy. */
type CuratedThread = ThreadCardProps & {
  authorId: string;
  /** Lowercased source_model for frontier swimlane matching. */
  sourceModelKey: string;
  tags: string[];
  createdAt: string;
};

/** Full first-user prompt for Discover cards (visual clamp + tooltip handle length). */
function firstPromptText(content: unknown): string {
  const messages = asChatMessages(content);
  const source =
    messages.find((message) => message.role === "user")?.content ??
    messages[0]?.content ??
    "";
  const plain = source
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[`#>*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "Open this conversation to read the full exchange.";
  // Soft cap so card props stay reasonable; line-clamp-4 truncates on the card.
  if (plain.length > 8000) return `${plain.slice(0, 7997).trimEnd()}…`;
  return plain;
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

function propsOf(row: PublicThreadRow): number {
  if (typeof row.props_count === "number") return Math.max(0, row.props_count);
  if (typeof row.total_tokens === "number") return Math.max(0, row.total_tokens);
  return 0;
}

function asEndorsements(
  value: unknown,
  usernamesByUserId: ReadonlyMap<string, string>
): MaxPropsEndorsementWithCurator[] {
  if (!Array.isArray(value)) return [];

  const rows: MaxPropsEndorsementWithCurator[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.id !== "string" || typeof row.thread_id !== "string") {
      continue;
    }
    if (typeof row.user_id !== "string" || typeof row.created_at !== "string") {
      continue;
    }
    const curatorUsername =
      usernamesByUserId.get(row.user_id)?.replace(/^@+/, "") || null;
    rows.push({
      id: row.id,
      thread_id: row.thread_id,
      user_id: row.user_id,
      comment: typeof row.comment === "string" ? row.comment : null,
      created_at: row.created_at,
      updated_at:
        typeof row.updated_at === "string" ? row.updated_at : row.created_at,
      curatorUsername,
    });
  }

  return rows.sort(
    (a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)
  );
}

function toCuratedThread(
  row: PublicThreadRow,
  usernamesByUserId: ReadonlyMap<string, string>
): CuratedThread {
  const tags = normalizedTags(row);
  return {
    id: row.id,
    title: row.title,
    personalNote: row.summary?.trim() || null,
    prompt: firstPromptText(row.content),
    modelName: modelDisplayName(row.source_model),
    sourceModel: row.source_model?.trim() || null,
    sourceUrl: row.source_url?.trim() || null,
    authorUsername:
      usernamesByUserId.get(row.author_id)?.replace(/^@+/, "") || "anonymous",
    propsCount: propsOf(row),
    slopCount: typeof row.slop_count === "number" ? row.slop_count : 0,
    maxPropsEndorsements: asEndorsements(
      row.max_props_endorsements,
      usernamesByUserId
    ),
    authorId: row.author_id,
    sourceModelKey: (row.source_model ?? "").trim().toLowerCase(),
    tags,
    createdAt: row.created_at,
  };
}

function haystack(thread: CuratedThread): string {
  return `${thread.title} ${thread.personalNote ?? ""} ${thread.prompt} ${thread.tags.join(" ")}`.toLowerCase();
}

function matchesKeywords(thread: CuratedThread, keywords: string[]): boolean {
  const text = haystack(thread);
  return keywords.some((keyword) => text.includes(keyword.toLowerCase()));
}

function sortByPropsDesc(threads: CuratedThread[]): CuratedThread[] {
  return [...threads].sort((a, b) => b.propsCount - a.propsCount);
}

function toCards(threads: CuratedThread[]): ThreadCardProps[] {
  return threads.map(
    ({
      authorId: _authorId,
      sourceModelKey: _sourceModelKey,
      tags: _tags,
      createdAt: _createdAt,
      ...card
    }) => card
  );
}

function matchesFrontierModel(
  sourceModel: string,
  patterns: string[]
): boolean {
  if (!sourceModel) return false;
  return patterns.some((pattern) => sourceModel.includes(pattern));
}

const FRONTIER_BUCKETS: { title: string; patterns: string[] }[] = [
  { title: "Gemini", patterns: ["gemini"] },
  { title: "Grok", patterns: ["grok"] },
  { title: "Meta", patterns: ["meta", "llama"] },
  { title: "ChatGPT", patterns: ["gpt", "chatgpt"] },
  { title: "DeepSeek", patterns: ["deepseek"] },
  { title: "Claude", patterns: ["claude"] },
  { title: "Perplexity", patterns: ["perplexity"] },
];

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("threads")
    .select(
      `
      id,
      author_id,
      title,
      content,
      summary,
      source_model,
      source_url,
      tags,
      total_tokens,
      props_count,
      slop_count,
      created_at,
      max_props_endorsements (
        id,
        thread_id,
        user_id,
        comment,
        created_at,
        updated_at
      )
    `
    )
    .eq("is_public", true)
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .order("created_at", {
      ascending: true,
      foreignTable: "max_props_endorsements",
    });

  const rows =
    !error && Array.isArray(data) ? (data as unknown as PublicThreadRow[]) : [];
  const authorIds = rows.map((row) => row.author_id).filter(Boolean);
  const endorserIds = rows.flatMap((row) =>
    (row.max_props_endorsements ?? []).map((endorsement) => endorsement.user_id)
  );
  const profileIds = Array.from(
    new Set([...authorIds, ...endorserIds].filter(Boolean))
  );
  const usernamesByUserId = new Map<string, string>();

  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, username")
      .in("id", profileIds);

    for (const profile of profiles ?? []) {
      if (
        typeof profile.id === "string" &&
        typeof profile.username === "string" &&
        profile.username.trim()
      ) {
        usernamesByUserId.set(
          profile.id,
          profile.username.trim().replace(/^@+/, "")
        );
      }
    }
  }

  const curated = rows.map((row) => toCuratedThread(row, usernamesByUserId));

  const topOfTheProps = sortByPropsDesc(curated).slice(0, 15);

  const trendingCutoff = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const trending = sortByPropsDesc(
    curated.filter((thread) => {
      const created = Date.parse(thread.createdAt);
      return Number.isFinite(created) && created >= trendingCutoff;
    })
  );

  const everythingLove = sortByPropsDesc(
    curated.filter((thread) =>
      matchesKeywords(thread, ["love", "relationships", "romance"])
    )
  );
  const everythingScience = sortByPropsDesc(
    curated.filter((thread) =>
      matchesKeywords(thread, ["science", "gpus", "physics", "universe"])
    )
  );
  const historyOfEverything = sortByPropsDesc(
    curated.filter((thread) =>
      matchesKeywords(thread, ["history", "ancient", "past", "empire"])
    )
  );
  const womenAndMen = sortByPropsDesc(
    curated.filter((thread) =>
      matchesKeywords(thread, ["gender", "women", "men", "society"])
    )
  );

  const myStuff = user
    ? sortByPropsDesc(
        curated.filter((thread) => thread.authorId === user.id)
      )
    : [];

  const claimedByFrontier = new Set<string>();
  const frontierLanes = FRONTIER_BUCKETS.map((bucket) => {
    const threads = sortByPropsDesc(
      curated.filter((thread) =>
        matchesFrontierModel(thread.sourceModelKey, bucket.patterns)
      )
    );
    for (const thread of threads) claimedByFrontier.add(thread.id);
    return { title: bucket.title, threads };
  });

  const openSourceOther = sortByPropsDesc(
    curated.filter((thread) => !claimedByFrontier.has(thread.id))
  );

  const topicLanes: { title: string; threads: CuratedThread[] }[] = [
    { title: "Top of the Props", threads: topOfTheProps },
    { title: "Trending", threads: trending },
    { title: "Everything Love", threads: everythingLove },
    { title: "Everything Science", threads: everythingScience },
    { title: "History of Everything", threads: historyOfEverything },
    { title: "Women & Men", threads: womenAndMen },
  ];

  if (user) {
    topicLanes.push({ title: "My Stuff", threads: myStuff });
  }

  return (
    <DiscoverWorkbench>
      <div className="relative min-h-[calc(100vh-3.5rem)] overflow-x-hidden bg-slate-950 text-white">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-950"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl"
        />

        <main className="relative z-10 space-y-5 py-6 pb-12">
          {error ? (
            <div className="mx-auto max-w-7xl px-6">
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300 backdrop-blur-md">
                The Discover feed is temporarily unavailable.
              </div>
            </div>
          ) : curated.length === 0 ? (
            <div className="mx-auto max-w-7xl px-6">
              <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center text-slate-300 backdrop-blur-md">
                No published conversations yet. Share the first one.
              </div>
            </div>
          ) : (
            <>
              {topicLanes.map((lane) => (
                <ConceptSwimlane
                  key={lane.title}
                  categoryName={lane.title}
                  threads={toCards(lane.threads)}
                />
              ))}

              {frontierLanes.map((lane) => (
                <ConceptSwimlane
                  key={lane.title}
                  categoryName={lane.title}
                  threads={toCards(lane.threads)}
                />
              ))}

              <ConceptSwimlane
                categoryName="Open Source / Other"
                threads={toCards(openSourceOther)}
              />
            </>
          )}
        </main>
      </div>
    </DiscoverWorkbench>
  );
}
