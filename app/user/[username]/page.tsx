import { notFound } from "next/navigation";

import { ThreadList } from "@/components/feed/thread-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";

interface UserPortfolioPageProps {
  params: Promise<{ username: string }> | { username: string };
}

const TAB_LIST_CLASS =
  "flex h-auto min-h-10 w-full flex-wrap items-stretch gap-1 bg-muted p-1 [&>button]:h-auto [&>button]:min-w-[5.5rem] [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs sm:[&>button]:text-sm";

export default async function UserPortfolioPage({
  params,
}: UserPortfolioPageProps) {
  const { username } = await Promise.resolve(params);
  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("username", username)
    .maybeSingle();

  if (profileError || !profile?.id) {
    notFound();
  }

  const { data: createdRows } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(id)"
    )
    .eq("author_id", profile.id)
    .eq("is_public", true)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  const createdThreads: ThreadWithFootnotes[] = (createdRows ?? []).flatMap(
    (row) => {
      if (!row || typeof row !== "object" || typeof row.id !== "string") {
        return [];
      }
      return [
        {
          ...row,
          content: asChatMessages(
            threadContentFromRow(row as Record<string, unknown>)
          ),
          tags: Array.isArray(row.tags) ? row.tags : [],
          footnotes: asFootnotes(row.footnotes).map((footnote) => ({
            ...footnote,
            score: 0,
            userVote: null,
          })),
          score: 0,
          userVote: null,
        } as ThreadWithFootnotes,
      ];
    }
  );

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

  let curatedThreads: ThreadWithFootnotes[] = [];
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

    curatedThreads = rankedIds.flatMap((threadId) => {
      const row = byId.get(threadId);
      if (!row || row.author_id === profile.id) return [];
      return [
        {
          ...row,
          content: asChatMessages(
            threadContentFromRow(row as Record<string, unknown>)
          ),
          tags: Array.isArray(row.tags) ? row.tags : [],
          footnotes: asFootnotes(row.footnotes).map((footnote) => ({
            ...footnote,
            score: 0,
            userVote: null,
          })),
          score: 0,
          userVote: null,
        } as ThreadWithFootnotes,
      ];
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">@{profile.username}</h1>
        <p className="text-muted-foreground">
          Public portfolio of created and curated conversations.
        </p>
      </header>

      <Tabs defaultValue="created" className="w-full">
        <TabsList className={TAB_LIST_CLASS}>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="curated">Curated</TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-6">
          <ThreadList threads={createdThreads} />
        </TabsContent>

        <TabsContent value="curated" className="mt-6">
          <ThreadList threads={curatedThreads} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
