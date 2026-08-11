"use client";

import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { ChatMessage } from "@/lib/types";

export type PendingThreadForReview = {
  id: string;
  title: string;
  source_model: string | null;
  tags: string[];
  content: ChatMessage[];
  author_email: string | null;
  author_id: string;
  created_at: string;
};

interface ModerationQueueProps {
  threads: PendingThreadForReview[];
}

export function ModerationQueue({ threads: initial }: ModerationQueueProps) {
  const router = useRouter();
  const [threads, setThreads] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function moderate(
    threadId: string,
    action: "approve" | "reject"
  ): Promise<void> {
    setBusyId(threadId);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/threads/${threadId}`, {
        method: action === "approve" ? "PATCH" : "DELETE",
        headers:
          action === "approve"
            ? { "Content-Type": "application/json" }
            : undefined,
        body:
          action === "approve"
            ? JSON.stringify({ action: "approve" })
            : undefined,
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error ||
            `Failed to ${action === "approve" ? "approve" : "reject"} thread.`
        );
      }

      setThreads((prev) => prev.filter((t) => t.id !== threadId));
      setNotice(
        payload.message ||
          (action === "approve"
            ? "Thread approved and published."
            : "Thread rejected and deleted.")
      );
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Moderation action failed."
      );
    } finally {
      setBusyId(null);
    }
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-xl border border-dashed px-6 py-16 text-center">
        <p className="text-muted-foreground">
          No threads awaiting review. Image submissions will land here.
        </p>
        {notice ? (
          <p className="mt-3 text-sm font-medium text-emerald-700">{notice}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {notice ? (
        <div
          role="status"
          className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
        >
          {notice}
        </div>
      ) : null}
      {error ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      ) : null}

      {threads.map((thread) => {
        const isBusy = busyId === thread.id;
        return (
          <Card key={thread.id} className="overflow-hidden">
            <CardHeader className="space-y-3 border-b bg-muted/30">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <CardTitle className="text-xl leading-snug">
                    {thread.title}
                  </CardTitle>
                  <CardDescription className="flex flex-wrap gap-x-3 gap-y-1 text-sm">
                    <span>
                      Source:{" "}
                      <span className="font-medium text-foreground">
                        {thread.source_model || "Unknown"}
                      </span>
                    </span>
                    <span>
                      Author:{" "}
                      <span className="font-medium text-foreground">
                        {thread.author_email || thread.author_id}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      Submitted{" "}
                      {new Date(thread.created_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </span>
                  </CardDescription>
                </div>
                <Badge variant="secondary">pending_review</Badge>
              </div>
              {thread.tags.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {thread.tags.map((tag) => (
                    <Badge key={tag} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">No tags</p>
              )}
            </CardHeader>

            <CardContent className="space-y-4 pt-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Full conversation
              </p>
              <div className="max-h-[28rem] space-y-4 overflow-y-auto pr-1">
                {thread.content.map((message, index) => {
                  const isUser = message.role === "user";
                  return (
                    <article
                      key={`${thread.id}-${message.role}-${index}`}
                      className={cn(
                        "rounded-xl border p-4",
                        isUser
                          ? "border-border bg-muted/50"
                          : "border-border bg-card"
                      )}
                    >
                      <span
                        className={cn(
                          "mb-2 inline-block rounded-md px-2 py-0.5 text-xs font-semibold",
                          isUser
                            ? "bg-secondary text-secondary-foreground"
                            : "bg-primary text-primary-foreground"
                        )}
                      >
                        {isUser ? "USER" : "AI"}
                      </span>
                      <MarkdownRenderer content={message.content} />
                    </article>
                  );
                })}
              </div>
            </CardContent>

            <CardFooter className="flex flex-wrap gap-3 border-t bg-muted/20 py-4">
              <Button
                type="button"
                disabled={busyId !== null}
                onClick={() => moderate(thread.id, "approve")}
                className="gap-2"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                ✅ Approve & Publish
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={busyId !== null}
                onClick={() => {
                  if (
                    typeof window !== "undefined" &&
                    !window.confirm(
                      "Reject and permanently delete this thread? This cannot be undone."
                    )
                  ) {
                    return;
                  }
                  void moderate(thread.id, "reject");
                }}
                className="gap-2"
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                ❌ Reject / Delete
              </Button>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}
