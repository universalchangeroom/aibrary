"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import {
  deleteThreadAndResolveReport,
  dismissReport,
} from "@/lib/actions/reports";
import type { ReportReason } from "@/lib/types";
import { cn } from "@/lib/utils";

export type PendingReportRow = {
  id: string;
  reason: ReportReason;
  created_at: string;
  thread_id: string | null;
  thread_title: string | null;
  thread_snippet: string;
  reporter_username: string | null;
};

const REASON_STYLES: Record<ReportReason, string> = {
  SPAM: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  PII: "border-cyan-400/40 bg-cyan-400/15 text-cyan-200",
  DANGER: "border-red-400/50 bg-red-500/20 text-red-300",
  OTHER: "border-violet-400/40 bg-violet-400/15 text-violet-200",
};

const REASON_LABELS: Record<ReportReason, string> = {
  SPAM: "Spam / Low Quality",
  PII: "Sensitive Info (PII)",
  DANGER: "Harmful / Dangerous",
  OTHER: "Other",
};

interface ReportsQueueProps {
  reports: PendingReportRow[];
}

export function ReportsQueue({ reports: initial }: ReportsQueueProps) {
  const router = useRouter();
  const [reports, setReports] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function runAction(
    reportId: string,
    action: "dismiss" | "strike"
  ): void {
    setBusyId(reportId);
    setError(null);
    setNotice(null);

    startTransition(async () => {
      try {
        const result =
          action === "dismiss"
            ? await dismissReport(reportId)
            : await deleteThreadAndResolveReport(reportId);

        if (!result.success) {
          throw new Error(result.error);
        }

        setReports((prev) => prev.filter((row) => row.id !== reportId));
        setNotice(result.message);
        router.refresh();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Report action failed."
        );
      } finally {
        setBusyId(null);
      }
    });
  }

  if (reports.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-6 py-16 text-center backdrop-blur-md">
        <p className="text-white/60">
          No pending reports. The carousel is clear.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300"
        >
          {error}
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm text-cyan-200"
        >
          {notice}
        </p>
      ) : null}

      <div className="hidden overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md md:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-white/10 text-xs uppercase tracking-wide text-white/50">
            <tr>
              <th className="px-5 py-4 font-medium">Date</th>
              <th className="px-5 py-4 font-medium">Reporter</th>
              <th className="px-5 py-4 font-medium">Reason</th>
              <th className="px-5 py-4 font-medium">Thread</th>
              <th className="px-5 py-4 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const busy = busyId === report.id;
              return (
                <tr
                  key={report.id}
                  className="border-b border-white/5 last:border-0"
                >
                  <td className="whitespace-nowrap px-5 py-4 text-white/70">
                    {new Date(report.created_at).toLocaleString()}
                  </td>
                  <td className="px-5 py-4 font-medium text-white">
                    {report.reporter_username
                      ? `@${report.reporter_username}`
                      : "Unknown"}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                        REASON_STYLES[report.reason]
                      )}
                    >
                      {REASON_LABELS[report.reason]}
                    </span>
                  </td>
                  <td className="max-w-xs px-5 py-4">
                    {report.thread_id ? (
                      <Link
                        href={`/feed/${report.thread_id}`}
                        className="block font-semibold text-white underline-offset-4 hover:underline"
                      >
                        {report.thread_title || "Untitled thread"}
                      </Link>
                    ) : (
                      <span className="font-semibold text-white/50">
                        Thread removed
                      </span>
                    )}
                    <p className="mt-1 line-clamp-2 text-white/55">
                      {report.thread_snippet}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <button
                        type="button"
                        disabled={busy || isPending}
                        onClick={() => runAction(report.id, "dismiss")}
                        className="rounded-xl border border-cyan-400/50 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-50"
                      >
                        {busy ? (
                          <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                        ) : (
                          "Dismiss"
                        )}
                      </button>
                      <button
                        type="button"
                        disabled={busy || isPending || !report.thread_id}
                        onClick={() => {
                          if (
                            !window.confirm(
                              "Delete this thread permanently and resolve the report?"
                            )
                          ) {
                            return;
                          }
                          runAction(report.id, "strike");
                        }}
                        className="rounded-xl border border-red-500 bg-red-500/20 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500/40 disabled:opacity-50"
                      >
                        Delete & Strike
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid gap-4 md:hidden">
        {reports.map((report) => {
          const busy = busyId === report.id;
          return (
            <article
              key={report.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold",
                    REASON_STYLES[report.reason]
                  )}
                >
                  {REASON_LABELS[report.reason]}
                </span>
                <time className="text-xs text-white/50">
                  {new Date(report.created_at).toLocaleString()}
                </time>
              </div>
              <p className="mt-3 text-sm text-white/70">
                Reporter:{" "}
                <span className="font-medium text-white">
                  {report.reporter_username
                    ? `@${report.reporter_username}`
                    : "Unknown"}
                </span>
              </p>
              {report.thread_id ? (
                <Link
                  href={`/feed/${report.thread_id}`}
                  className="mt-2 block text-lg font-semibold text-white"
                >
                  {report.thread_title || "Untitled thread"}
                </Link>
              ) : (
                <p className="mt-2 text-lg font-semibold text-white/50">
                  Thread removed
                </p>
              )}
              <p className="mt-2 line-clamp-3 text-sm text-white/55">
                {report.thread_snippet}
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={busy || isPending}
                  onClick={() => runAction(report.id, "dismiss")}
                  className="rounded-xl border border-cyan-400/50 px-3 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-400/10 disabled:opacity-50"
                >
                  Dismiss
                </button>
                <button
                  type="button"
                  disabled={busy || isPending || !report.thread_id}
                  onClick={() => {
                    if (
                      !window.confirm(
                        "Delete this thread permanently and resolve the report?"
                      )
                    ) {
                      return;
                    }
                    runAction(report.id, "strike");
                  }}
                  className="rounded-xl border border-red-500 bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/40 disabled:opacity-50"
                >
                  Delete & Strike
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
