"use client";

import { ExternalLink, MessageSquareWarning } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { VoteButtons } from "@/components/ui/vote-buttons";
import type { FootnoteWithVotes } from "@/lib/types";

interface FootnoteSheetProps {
  footnotes: FootnoteWithVotes[];
  threadId: string;
  trigger?: "icon" | "header";
}

function communityNotesLabel(count: number): string {
  return count === 1 ? "1 Community Note" : `${count} Community Notes`;
}

function FootnoteCard({
  footnote,
  threadId,
}: {
  footnote: FootnoteWithVotes;
  threadId: string;
}) {
  const disputedClaim =
    footnote.quoted_text?.trim() || "No quoted passage was provided.";
  const sourceUrl = footnote.source_url?.trim() || null;

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 shadow-none">
      <div className="flex gap-2">
        <VoteButtons
          targetType="footnote"
          targetId={footnote.id}
          initialScore={footnote.score}
          userVote={footnote.userVote}
          revalidatePathName={`/feed/${threadId}`}
          className="pl-2 pt-4"
        />

        <div className="min-w-0 flex-1">
          <CardHeader className="space-y-2 p-4 pb-2 pl-2">
            <Badge
              variant="outline"
              className="w-fit border-amber-300 text-amber-700"
            >
              Disputed claim
            </Badge>
            <CardTitle className="text-sm font-medium leading-relaxed">
              <blockquote className="border-l-2 border-amber-400 pl-3 text-sm italic font-normal text-muted-foreground">
                “{disputedClaim}”
              </blockquote>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 p-4 pt-2 pl-2">
            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Community context
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {footnote.body}
              </p>
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Source
              </h3>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
                >
                  {sourceUrl.replace(/^https?:\/\//, "")}
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-sm text-muted-foreground">No source linked.</p>
              )}
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

export function FootnoteSheet({
  footnotes,
  threadId,
  trigger = "icon",
}: FootnoteSheetProps) {
  if (footnotes.length === 0) {
    return null;
  }

  const sortedFootnotes = [...footnotes].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const count = sortedFootnotes.length;

  return (
    <Sheet>
      <SheetTrigger asChild>
        {trigger === "header" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800"
          >
            <MessageSquareWarning className="h-4 w-4" />
            {communityNotesLabel(count)}
          </Button>
        ) : (
          <button
            type="button"
            className="inline-flex translate-y-[-0.1em] items-center text-amber-600 hover:text-amber-700"
            aria-label={communityNotesLabel(count)}
            title={communityNotesLabel(count)}
          >
            <MessageSquareWarning className="h-3.5 w-3.5" />
          </button>
        )}
      </SheetTrigger>

      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
        <SheetHeader className="space-y-2 text-left">
          <Badge
            variant="outline"
            className="w-fit border-amber-300 text-amber-700"
          >
            Community annotations
          </Badge>
          <SheetTitle>{communityNotesLabel(count)}</SheetTitle>
          <SheetDescription>
            Context and corrections shared by the ChatShare community for this
            conversation.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 flex flex-col gap-4 pb-6">
          {sortedFootnotes.map((footnote) => (
            <FootnoteCard
              key={footnote.id}
              footnote={footnote}
              threadId={threadId}
            />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
