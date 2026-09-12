import Link from "next/link";
import { redirect } from "next/navigation";

import { ReportsQueue, type PendingReportRow } from "@/components/admin/reports-queue";
import { isAdminUser } from "@/lib/admin-server";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { asChatMessages, type ReportReason } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isReportReason(value: unknown): value is ReportReason {
  return (
    value === "SPAM" ||
    value === "PII" ||
    value === "DANGER" ||
    value === "OTHER"
  );
}

function snippetFromThread(row: {
  title?: unknown;
  summary?: unknown;
  content?: unknown;
}): string {
  if (typeof row.summary === "string" && row.summary.trim()) {
    return row.summary.trim();
  }

  const messages = asChatMessages(row.content);
  const first = messages.find((message) => message.content.trim());
  if (first?.content) {
    return first.content.trim().slice(0, 180);
  }

  if (typeof row.title === "string" && row.title.trim()) {
    return row.title.trim();
  }

  return "No preview available.";
}

export default async function AdminReportsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent("/admin/reports")}`);
  }

  if (!(await isAdminUser(user))) {
    redirect("/");
  }

  let loadError: string | null = null;
  let reports: PendingReportRow[] = [];

  try {
    const admin = createServiceClient();
    const { data, error } = await admin
      .from("reports")
      .select(
        `
        id,
        reason,
        status,
        created_at,
        thread_id,
        reporter_id,
        threads (
          id,
          title,
          summary,
          content
        ),
        profiles!reports_reporter_id_fkey (
          username
        )
      `
      )
      .eq("status", "PENDING")
      .order("created_at", { ascending: true });

    if (error) {
      loadError = error.message;
    } else {
      reports = (data ?? []).flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const id = typeof row.id === "string" ? row.id : null;
        if (!id || !isReportReason(row.reason)) return [];

        const threadRaw = row.threads;
        const thread = Array.isArray(threadRaw)
          ? threadRaw[0]
          : threadRaw && typeof threadRaw === "object"
            ? threadRaw
            : null;

        const profileRaw = row.profiles;
        const profile = Array.isArray(profileRaw)
          ? profileRaw[0]
          : profileRaw && typeof profileRaw === "object"
            ? profileRaw
            : null;

        const threadObj =
          thread && typeof thread === "object"
            ? (thread as {
                id?: unknown;
                title?: unknown;
                summary?: unknown;
                content?: unknown;
              })
            : null;

        return [
          {
            id,
            reason: row.reason,
            created_at:
              typeof row.created_at === "string"
                ? row.created_at
                : new Date().toISOString(),
            thread_id:
              typeof row.thread_id === "string"
                ? row.thread_id
                : typeof threadObj?.id === "string"
                  ? threadObj.id
                  : null,
            thread_title:
              typeof threadObj?.title === "string" ? threadObj.title : null,
            thread_snippet: snippetFromThread(threadObj ?? {}),
            reporter_username:
              profile &&
              typeof profile === "object" &&
              typeof (profile as { username?: unknown }).username === "string"
                ? ((profile as { username: string }).username)
                : null,
          } satisfies PendingReportRow,
        ];
      });
    }
  } catch (err) {
    loadError =
      err instanceof Error
        ? err.message
        : "Failed to load reports. Ensure SUPABASE_SERVICE_ROLE_KEY is set.";
  }

  return (
    <main className="min-h-screen bg-black/95 p-8 text-white">
      <div className="mx-auto w-full max-w-6xl">
        <header className="mb-8 space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
            Admin
          </p>
          <h1 className="mb-2 bg-gradient-to-r from-pink-500 to-cyan-400 bg-clip-text text-4xl font-black text-transparent">
            Security & Moderation
          </h1>
          <p className="max-w-2xl text-white/60">
            Review pending community reports. Dismiss false alarms, or delete
            offending threads and strike the ticket resolved.
          </p>
          <p className="text-xs text-white/40">
            {reports.length} pending
            {" · "}
            <Link
              href="/admin/moderation"
              className="text-cyan-300/80 underline-offset-4 hover:underline"
            >
              Image moderation
            </Link>
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
          {loadError ? (
            <div
              role="alert"
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
            >
              {loadError}
            </div>
          ) : (
            <ReportsQueue reports={reports} />
          )}
        </section>
      </div>
    </main>
  );
}
