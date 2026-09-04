import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";

import { AuthorLink } from "@/components/feed/author-link";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormattedTime } from "@/components/formatted-time";
import { PropsDisplay } from "@/components/feed/props-display";
import { SourceModelBadge } from "@/components/feed/source-model-badge";
import { cn } from "@/lib/utils";
import type { ChatMessage, ThreadWithFootnotes } from "@/lib/types";

interface ThreadCardProps {
  thread: ThreadWithFootnotes;
  variant?: "default" | "discover";
}

function conversationPreview(messages: ChatMessage[] | null | undefined): string {
  const list = messages ?? [];
  const firstUser = list.find((m) => m.role === "user");
  const firstAssistant = list.find((m) => m.role === "assistant");

  if (firstUser && firstAssistant) {
    return `${firstUser.content} — ${firstAssistant.content}`;
  }

  return list.map((m) => m.content).join(" — ");
}

export function ThreadCard({ thread, variant = "default" }: ThreadCardProps) {
  const preview = conversationPreview(thread.content);
  const tags = thread.tags ?? [];
  const hasFootnotes = (thread.footnotes ?? []).length > 0;
  const isDiscover = variant === "discover";

  return (
    <Card
      className={cn(
        "transition-colors",
        isDiscover
          ? "border border-orange-200 bg-white/80 text-stone-800 shadow-sm backdrop-blur-sm hover:bg-white/90"
          : "hover:bg-muted/40"
      )}
    >
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-snug">
            <Link
              href={`/feed/${thread.id}`}
              className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="inline-flex items-center gap-2">
                {thread.title}
                {hasFootnotes ? (
                  <span
                    className="inline-flex items-center text-amber-600"
                    title="This thread has community footnotes"
                    aria-label="Has community footnotes"
                  >
                    <MessageSquareWarning className="h-4 w-4" />
                  </span>
                ) : null}
              </span>
            </Link>
          </CardTitle>
          {thread.source_model ? (
            <SourceModelBadge
              sourceModel={thread.source_model}
              className="shrink-0"
            />
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-wrap items-center gap-x-3 gap-y-1 text-xs",
            isDiscover ? "text-stone-600" : "text-muted-foreground"
          )}
        >
          <AuthorLink
            author={thread.author}
            authorId={thread.author_id}
            className={cn(
              "text-xs",
              isDiscover
                ? "text-stone-700 hover:text-orange-700"
                : "text-foreground/80"
            )}
          />
          {thread.created_at ? (
            <FormattedTime
              date={thread.created_at}
              className={cn(
                "text-xs",
                isDiscover ? "text-stone-600" : "text-muted-foreground"
              )}
            />
          ) : null}
        </div>

        {isDiscover ? (
          <PropsDisplay total={thread.total_tokens} variant="card" />
        ) : (
          <p className="text-sm font-semibold text-primary">
            Props:{" "}
            <span className="text-base">
              {typeof thread.total_tokens === "number"
                ? thread.total_tokens
                : 0}
            </span>
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent>
        <Link
          href={`/feed/${thread.id}`}
          className="block rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <CardDescription
            className={cn(
              "line-clamp-2 text-sm leading-relaxed",
              isDiscover && "text-stone-600"
            )}
          >
            {preview || "No conversation preview available."}
          </CardDescription>
        </Link>
      </CardContent>
    </Card>
  );
}
