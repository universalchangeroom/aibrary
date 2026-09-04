import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { ThreadList } from "@/components/feed/thread-list";
import { FormattedTime } from "@/components/formatted-time";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  asAuthorProfile,
  authorDisplayName,
  enrichAuthorsWithEmails,
  isUuid,
  type AuthorProfile,
} from "@/lib/author-profile";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";

export const dynamic = "force-dynamic";

const TAB_LIST_CLASS =
  "flex h-auto min-h-10 w-full flex-wrap items-stretch gap-1 bg-orange-100/70 p-1 [&>button]:h-auto [&>button]:min-w-[5.5rem] [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs sm:[&>button]:text-sm";

function PortfolioEmptyState({
  title,
  subtitle,
  buttonLabel,
  href,
}: {
  title: string;
  subtitle: string;
  buttonLabel: string;
  href: string;
}) {
  return (
    <Card
      className="border border-dashed border-orange-200 bg-white/80 text-stone-800 shadow-sm backdrop-blur-sm"
      aria-label={title}
    >
      <CardHeader className="items-center space-y-3 pb-3 pt-12 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="max-w-md text-base leading-relaxed text-stone-600">
          {subtitle}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-12 pt-2">
        <Button asChild size="lg" className="gap-2">
          <Link href={href}>
            <Plus className="h-4 w-4" aria-hidden />
            {buttonLabel}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function mapThreadRows(
  rows: unknown[] | null | undefined,
  author: AuthorProfile | null
): ThreadWithFootnotes[] {
  return (rows ?? []).flatMap((row) => {
    if (
      !row ||
      typeof row !== "object" ||
      typeof (row as { id?: unknown }).id !== "string"
    ) {
      return [];
    }
    const r = row as Record<string, unknown> & { id: string };
    return [
      {
        ...r,
        content: asChatMessages(threadContentFromRow(r)),
        tags: Array.isArray(r.tags) ? (r.tags as string[]) : [],
        footnotes: asFootnotes(r.footnotes).map((footnote) => ({
          ...footnote,
          score: 0,
          userVote: null,
        })),
        score: 0,
        userVote: null,
        author,
      } as ThreadWithFootnotes,
    ];
  });
}

async function resolveProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  slug: string
): Promise<AuthorProfile | null> {
  const decoded = decodeURIComponent(slug).trim();
  if (!decoded) return null;

  if (isUuid(decoded)) {
    const { data } = await supabase
      .from("profiles")
      .select("id, username, display_name, bio, avatar_url, created_at")
      .eq("id", decoded)
      .maybeSingle();
    return asAuthorProfile(data);
  }

  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("username", decoded)
    .maybeSingle();

  return asAuthorProfile(data);
}

/**
 * Public author portfolio at `/user/[username]` or `/user/[author_id]`.
 * The dynamic segment accepts either a custom username or a UUID.
 */
export default async function PublicPortfolioPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  const { id: slug } = await Promise.resolve(params);
  const supabase = await createClient();

  let profile = await resolveProfile(supabase, slug);
  if (!profile) {
    notFound();
  }

  const enrichMap = new Map([[profile.id, profile]]);
  await enrichAuthorsWithEmails(enrichMap);
  profile = enrichMap.get(profile.id) ?? profile;

  const trimmedDisplayName = profile.display_name?.trim() || null;
  const trimmedUsername = profile.username?.trim().replace(/^@/, "") || null;

  // Prefer display_name; fall back to @username, then email prefix / Anonymous.
  const headline = trimmedDisplayName
    ? trimmedDisplayName
    : trimmedUsername
      ? `@${trimmedUsername}`
      : authorDisplayName(profile);

  // Show @username under the display name when both exist (avoid duplicating the headline).
  const handleLabel =
    trimmedDisplayName && trimmedUsername ? `@${trimmedUsername}` : null;

  const bioText = profile.bio?.trim() || null;
  const avatarInitial = (
    trimmedDisplayName ||
    trimmedUsername ||
    (headline === "Anonymous" ? "?" : headline)
  )
    .replace(/^@/, "")
    .charAt(0)
    .toUpperCase();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwnPortfolio = user?.id === profile.id;

  const { data: createdRows } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(id)"
    )
    .eq("author_id", profile.id)
    .eq("is_public", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const createdThreads = mapThreadRows(createdRows, profile);

  const { data: txRows } = await supabase
    .from("token_transactions")
    .select("thread_id, amount")
    .eq("giver_id", profile.id);

  const threadTotals = new Map<string, number>();
  for (const tx of txRows ?? []) {
    if (!tx?.thread_id) continue;
    const amount = typeof tx.amount === "number" ? tx.amount : 0;
    threadTotals.set(tx.thread_id, (threadTotals.get(tx.thread_id) ?? 0) + amount);
  }

  const rankedIds = [...threadTotals.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([threadId]) => threadId);

  let creditedThreads: ThreadWithFootnotes[] = [];
  if (rankedIds.length > 0) {
    const { data: curatedRows } = await supabase
      .from("threads")
      .select(
        "id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(id)"
      )
      .in("id", rankedIds)
      .eq("is_public", true)
      .eq("status", "published");

    const byId = new Map(
      (curatedRows ?? []).map((row) => [String(row.id), row] as const)
    );

    creditedThreads = rankedIds.flatMap((threadId) => {
      const row = byId.get(threadId);
      if (!row || row.author_id === profile!.id) return [];
      return mapThreadRows([row], null);
    });
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 text-stone-800">
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16">
        <header className="space-y-3 rounded-xl bg-gradient-to-r from-amber-500/10 via-orange-400/10 to-transparent px-4 py-6">
          <div className="flex items-center gap-4">
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatar_url}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-orange-200"
              />
            ) : (
              <div
                className="flex h-14 w-14 items-center justify-center rounded-full bg-orange-100 text-lg font-semibold text-orange-800"
                aria-hidden
              >
                {avatarInitial || "?"}
              </div>
            )}
            <div className="min-w-0 space-y-1">
              <h1 className="truncate text-3xl font-bold tracking-tight text-gray-900">
                {headline}
              </h1>
              {handleLabel ? (
                <p className="text-sm font-medium text-stone-700">{handleLabel}</p>
              ) : null}
              {bioText ? (
                <p className="max-w-prose text-sm leading-relaxed text-stone-600">
                  {bioText}
                </p>
              ) : null}
              {profile.created_at ? (
                <p className="text-xs text-stone-500">
                  Joined{" "}
                  <FormattedTime
                    date={profile.created_at}
                    className="inline text-xs text-stone-500"
                  />
                </p>
              ) : null}
            </div>
          </div>
        </header>

        <Tabs defaultValue="created" className="w-full">
          <TabsList className={TAB_LIST_CLASS}>
            <TabsTrigger value="created">Created</TabsTrigger>
            <TabsTrigger value="credited">Credited</TabsTrigger>
          </TabsList>

          <TabsContent value="created" className="mt-6">
            {createdThreads.length > 0 ? (
              <ThreadList threads={createdThreads} variant="discover" />
            ) : (
              <PortfolioEmptyState
                title="No public threads published yet"
                subtitle={
                  isOwnPortfolio
                    ? "Be the first to share an AI conversation with the community!"
                    : "This author has not published any public threads yet."
                }
                buttonLabel={
                  isOwnPortfolio
                    ? "Import or Paste Transcript"
                    : "Explore Discover"
                }
                href={isOwnPortfolio ? "/share" : "/feed"}
              />
            )}
          </TabsContent>

          <TabsContent value="credited" className="mt-6">
            {creditedThreads.length > 0 ? (
              <ThreadList threads={creditedThreads} variant="discover" />
            ) : (
              <PortfolioEmptyState
                title="No Props given yet."
                subtitle="Discover brilliant AI conversations and give them the credit they deserve!"
                buttonLabel="Explore the Community"
                href="/feed"
              />
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
