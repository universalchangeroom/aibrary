"use client";

import { Plus, Trash2 } from "lucide-react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import { RichTextEditor } from "@/components/rich-text-editor";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ChatMessage, FootnoteWithVotes } from "@/lib/types";

interface ConversationViewProps {
  messages: ChatMessage[];
  footnotes?: FootnoteWithVotes[];
  threadId: string;
  isEditing?: boolean;
  onMessageContentChange?: (index: number, content: string) => void;
  onRemoveMessage?: (index: number) => void;
  onAddMessage?: () => void;
}

function RoleBadge({ isUser }: { isUser: boolean }) {
  return (
    <span
      className={cn(
        "rounded-md px-2 py-0.5 text-xs font-semibold",
        isUser
          ? "bg-secondary text-secondary-foreground"
          : "bg-primary text-primary-foreground"
      )}
    >
      {isUser ? "USER" : "AI"}
    </span>
  );
}

export function ConversationView({
  messages,
  footnotes: _footnotes = [],
  threadId: _threadId,
  isEditing = false,
  onMessageContentChange,
  onRemoveMessage,
  onAddMessage,
}: ConversationViewProps) {
  const list = isEditing
    ? messages
    : messages.filter((message) => message.role !== "system");

  return (
    <section className="flex flex-col gap-5" aria-label="Conversation">
      {list.map((message, index) => {
        const isUser = message.role === "user";

        return (
          <article
            key={`${message.role}-${index}`}
            className={cn(
              "rounded-xl border p-4 sm:p-5",
              isUser
                ? "ml-0 border-border bg-muted/50 text-foreground sm:mr-12"
                : "mr-0 border-border bg-card text-card-foreground sm:ml-12"
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <RoleBadge isUser={isUser} />
              {isEditing && onRemoveMessage ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemoveMessage(index)}
                  aria-label={`Delete ${isUser ? "user" : "AI"} message`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : null}
            </div>

            {isEditing && onMessageContentChange ? (
              <RichTextEditor
                content={message.content}
                onChange={(markdown) =>
                  onMessageContentChange(index, markdown)
                }
                placeholder={
                  isUser ? "User message…" : "Assistant / AI response…"
                }
                className="bg-background"
                editorClassName="min-h-[120px]"
              />
            ) : (
              <MarkdownRenderer content={message.content} />
            )}
          </article>
        );
      })}

      {isEditing && onAddMessage ? (
        <div className="flex justify-center pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onAddMessage}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            Add Message
          </Button>
        </div>
      ) : null}
    </section>
  );
}
