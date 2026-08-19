import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FormattedTime } from "@/components/formatted-time";
import type { ChatMessage, ThreadWithFootnotes } from "@/lib/types";

interface ThreadCardProps {
  thread: ThreadWithFootnotes;
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

export function ThreadCard({ thread }: ThreadCardProps) {
  const preview = conversationPreview(thread.content);
  const tags = thread.tags ?? [];
  const hasFootnotes = (thread.footnotes ?? []).length > 0;

  return (
    <div className="rounded-xl focus-within:ring-2 focus-within:ring-ring">
      <Link
        href={`/feed/${thread.id}`}
        className="min-w-0 flex-1 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Card className="transition-colors hover:bg-muted/40">
          <CardHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <CardTitle className="text-lg leading-snug">
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
              </CardTitle>
              {thread.source_model ? (
                <Badge variant="secondary" className="shrink-0">
                  {thread.source_model}
                </Badge>
              ) : null}
            </div>

            <p className="text-sm font-semibold text-primary">
              Props:{" "}
              <span className="text-base">
                {typeof thread.total_tokens === "number" ? thread.total_tokens : 0}
              </span>
            </p>

            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
            {thread.created_at ? (
              <FormattedTime
                date={thread.created_at}
                className="text-xs text-muted-foreground"
              />
            ) : null}
          </CardHeader>

          <CardContent>
            <CardDescription className="line-clamp-2 text-sm leading-relaxed">
              {preview || "No conversation preview available."}
            </CardDescription>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
