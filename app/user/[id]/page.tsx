import Link from "next/link";
import { Plus } from "lucide-react";

import { ThreadList } from "@/components/feed/thread-list";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";

const TAB_LIST_CLASS =
  "flex h-auto min-h-10 w-full flex-wrap items-stretch gap-1 bg-muted p-1 [&>button]:h-auto [&>button]:min-w-[5.5rem] [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs sm:[&>button]:text-sm";

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
    <Card className="border-dashed bg-muted/20 shadow-none">
      <CardHeader className="items-center space-y-3 pb-3 pt-12 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">
          {title}
        </CardTitle>
        <CardDescription className="max-w-md text-base leading-relaxed">
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

export default async function PortfolioPage({
  params,
}: {
  params: { id: string };
}) {
  const { id } = params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username")
    .eq("id", id)
    .maybeSingle();

  const { data: createdRows } = await supabase
    .from("threads")
    .select(
      "id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(id)"
    )
    .eq("author_id", id)
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
    .eq("giver_id", id);

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
      if (!row || row.author_id === id) return [];
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
        <h1 className="text-3xl font-bold tracking-tight">
          @{profile?.username || "user"}
        </h1>
        <p className="text-muted-foreground">
          Public portfolio of created and credited conversations.
        </p>
      </header>

      <Tabs defaultValue="created" className="w-full">
        <TabsList className={TAB_LIST_CLASS}>
          <TabsTrigger value="created">Created</TabsTrigger>
          <TabsTrigger value="credited">Credited</TabsTrigger>
        </TabsList>

        <TabsContent value="created" className="mt-6">
          {createdThreads.length > 0 ? (
            <ThreadList threads={createdThreads} />
          ) : (
            <PortfolioEmptyState
              title="No threads published yet."
              subtitle="Be the first to share an AI conversation with the community!"
              buttonLabel="+ Import or Paste Transcript"
              href="/share"
            />
          )}
        </TabsContent>

        <TabsContent value="credited" className="mt-6">
          {creditedThreads.length > 0 ? (
            <ThreadList threads={creditedThreads} />
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
  );
}
