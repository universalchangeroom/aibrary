import Link from "next/link";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";

import { ModerationQueue } from "@/components/admin/moderation-queue";
import { Button } from "@/components/ui/button";
import { getAdminEmails, isAdminEmail } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { asChatMessages } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveAuthorEmails(
  admin: ReturnType<typeof createServiceClient>,
  authorIds: string[]
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const unique = Array.from(new Set(authorIds.filter(Boolean)));

  await Promise.all(
    unique.map(async (id) => {
      try {
        const { data, error } = await admin.auth.admin.getUserById(id);
        if (error || !data.user) {
          map.set(id, null);
          return;
        }
        map.set(id, data.user.email ?? null);
      } catch {
        map.set(id, null);
      }
    })
  );

  return map;
}

export default async function AdminModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/admin/moderation")}`);
  }

  if (!isAdminEmail(user.email)) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 px-6 py-24 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive" aria-hidden />
        <h1 className="text-2xl font-bold tracking-tight">Access denied</h1>
        <p className="text-muted-foreground">
          This moderation queue is limited to authorized admin accounts.
          {getAdminEmails().length === 0
            ? " Set ADMIN_EMAILS (or ADMIN_EMAIL) in the server environment."
            : null}
        </p>
        <Button asChild variant="outline">
          <Link href="/feed">Back to Discover</Link>
        </Button>
      </main>
    );
  }

  let loadError: string | null = null;
  let threads: {
    id: string;
    title: string;
    source_model: string | null;
    tags: string[];
    content: ReturnType<typeof asChatMessages>;
    author_email: string | null;
    author_id: string;
    created_at: string;
  }[] = [];

  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("threads")
      .select(
        "id, title, source_model, tags, content, author_id, created_at, status"
      )
      .eq("status", "pending_review")
      .order("created_at", { ascending: true });

    if (error) {
      loadError = error.message;
    } else {
      const rows = data ?? [];
      const emails = await resolveAuthorEmails(
        admin,
        rows.map((row) => row.author_id as string)
      );

      threads = rows.map((row) => ({
        id: row.id as string,
        title: (row.title as string) || "Untitled",
        source_model: (row.source_model as string | null) ?? null,
        tags: Array.isArray(row.tags) ? (row.tags as string[]) : [],
        content: asChatMessages(row.content),
        author_id: row.author_id as string,
        author_email: emails.get(row.author_id as string) ?? null,
        created_at: row.created_at as string,
      }));
    }
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Failed to load pending threads. Ensure SUPABASE_SERVICE_ROLE_KEY is set.";
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2 border-b pb-6">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Admin
        </p>
        <h1 className="text-3xl font-bold tracking-tight">
          Image thread moderation
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Review submissions that include Markdown images before they appear on
          Discover. Approve to publish, or reject to delete permanently.
        </p>
        <p className="text-xs text-muted-foreground">
          Signed in as{" "}
          <span className="font-medium text-foreground">{user.email}</span>
          {" · "}
          {threads.length} pending
        </p>
      </header>

      {loadError ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {loadError}
        </div>
      ) : (
        <ModerationQueue threads={threads} />
      )}
    </main>
  );
}
