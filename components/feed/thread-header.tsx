"use client";

import { useState } from "react";
import { Check, Copy, MessageSquareWarning, Pencil } from "lucide-react";

import { AddFootnoteDialog } from "@/components/feed/add-footnote-dialog";
import { FootnoteSheet } from "@/components/feed/footnote-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import type { ThreadWithFootnotes } from "@/lib/types";

interface ThreadHeaderProps {
  thread: ThreadWithFootnotes;
  isAuthenticated: boolean;
  isEditing: boolean;
  onToggleEditing: () => void;
  editTitle: string;
  onEditTitleChange: (title: string) => void;
}

export function ThreadHeader({
  thread,
  isAuthenticated,
  isEditing,
  onToggleEditing,
  editTitle,
  onEditTitleChange,
}: ThreadHeaderProps) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const footnoteCount = thread.footnotes.length;

  // Schema field is author_id (owner / user_id).
  const ownerId = thread.author_id;
  const isOwner = Boolean(user?.id && ownerId && user.id === ownerId);

  async function copySystemPrompt() {
    const prompt = "No system prompt was shared for this conversation.";

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <header className="space-y-4 border-b pb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {isEditing ? (
              <Input
                type="text"
                value={editTitle}
                onChange={(event) => onEditTitleChange(event.target.value)}
                className="h-auto max-w-xl text-3xl font-bold tracking-tight md:text-3xl"
                aria-label="Thread title"
                placeholder="Thread title"
              />
            ) : (
              <h1 className="text-3xl font-bold tracking-tight">
                {thread.title}
              </h1>
            )}
            {footnoteCount > 0 && !isEditing ? (
              <span className="inline-flex text-amber-600" aria-hidden>
                <MessageSquareWarning className="h-5 w-5" />
              </span>
            ) : null}
            {isEditing ? (
              <Badge variant="outline" className="border-primary/40 text-primary">
                Editing
              </Badge>
            ) : null}
          </div>
          {thread.source_model ? (
            <Badge variant="secondary">{thread.source_model}</Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {isAuthenticated && !isEditing ? (
            <AddFootnoteDialog threadId={thread.id} />
          ) : null}
          {footnoteCount > 0 && !isEditing ? (
            <FootnoteSheet
              footnotes={thread.footnotes}
              threadId={thread.id}
              trigger="header"
            />
          ) : null}
          {!isEditing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copySystemPrompt}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied" : "Copy System Prompt"}
            </Button>
          ) : null}
          {isOwner ? (
            <Button
              type="button"
              variant={isEditing ? "default" : "outline"}
              size="sm"
              onClick={onToggleEditing}
              aria-pressed={isEditing}
            >
              <Pencil className="h-4 w-4" />
              {isEditing ? "Cancel Edit" : "Edit Thread"}
            </Button>
          ) : null}
        </div>
      </div>

      {!isEditing ? (
        <div className="flex flex-wrap gap-2">
          {thread.tags.map((tag) => (
            <Badge key={tag} variant="outline">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}
    </header>
  );
}
