import { redirect } from "next/navigation";

import { ThreadList } from "@/components/feed/thread-list";
import { createClient } from "@/lib/supabase/server";
import {
  asChatMessages,
  asFootnotes,
  threadContentFromRow,
  type ThreadWithFootnotes,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StarredDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: starredRows } = await supabase
    .from("starred_threads")
    .select(
      "created_at, thread_id, threads(id, author_id, title, content, source_model, tags, is_public, status, total_tokens, created_at, updated_at, footnotes(id))"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const threads: ThreadWithFootnotes[] = (starredRows ?? []).flatMap((row) => {
    const thread = row?.threads as Record<string, unknown> | null;
    if (!thread || typeof thread.id !== "string") return [];
    return [
      {
        ...(thread as unknown as ThreadWithFootnotes),
        content: asChatMessages(threadContentFromRow(thread)),
        tags: Array.isArray(thread.tags) ? (thread.tags as string[]) : [],
        footnotes: asFootnotes(thread.footnotes).map((footnote) => ({
          ...footnote,
          score: 0,
          userVote: null,
        })),
        score: 0,
        userVote: null,
      },
    ];
  });

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Starred</h1>
        <p className="text-muted-foreground">
          Your private reading list of saved threads.
        </p>
      </header>

      <ThreadList threads={threads} />
    </main>
  );
}
