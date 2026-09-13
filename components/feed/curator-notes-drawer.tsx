"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Pencil } from "lucide-react";

import { CuratorNoteModal } from "@/components/feed/curator-note-modal";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useAuth } from "@/hooks/use-auth";
import type { MaxPropsEndorsementWithCurator } from "@/lib/types";
import { cn } from "@/lib/utils";

interface CuratorNotesDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  threadTitle: string;
  endorsements: MaxPropsEndorsementWithCurator[];
  /** Sync updated comments back to the parent card after edit. */
  onEndorsementsChange?: (
    endorsements: MaxPropsEndorsementWithCurator[]
  ) => void;
}

function usernameMonogram(username: string | null | undefined): string {
  const cleaned = username?.trim().replace(/^@+/, "") ?? "";
  if (!cleaned) return "?";
  return cleaned.slice(0, Math.min(2, cleaned.length)).toUpperCase();
}

function formatEndorsementDate(iso: string): string {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return "Unknown date";
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function CuratorMonogram({
  username,
}: {
  username: string | null;
}) {
  return (
    <span
      className={cn(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
        "border border-amber-400/40 bg-gradient-to-br from-amber-500/30 via-orange-500/20 to-rose-600/25",
        "font-serif text-xs font-bold tracking-wide text-amber-100",
        "shadow-[0_0_12px_rgba(245,158,11,0.35)]"
      )}
      aria-hidden
    >
      {usernameMonogram(username)}
    </span>
  );
}

/**
 * Slide-out drawer of Max Props curator notes (oldest first).
 */
export function CuratorNotesDrawer({
  open,
  onOpenChange,
  threadId,
  threadTitle,
  endorsements: initialEndorsements,
  onEndorsementsChange,
}: CuratorNotesDrawerProps) {
  const { user } = useAuth();
  const [endorsements, setEndorsements] = useState(initialEndorsements);
  const [editOpen, setEditOpen] = useState(false);
  const [editingComment, setEditingComment] = useState<string | null>(null);

  useEffect(() => {
    setEndorsements(initialEndorsements);
  }, [initialEndorsements]);

  function handleEditNote(comment: string | null) {
    setEditingComment(comment);
    onOpenChange(false);
    setEditOpen(true);
  }

  function handleEditOpenChange(nextOpen: boolean) {
    setEditOpen(nextOpen);
    if (!nextOpen) {
      // Return to the drawer after edit/cancel so the update is visible.
      onOpenChange(true);
    }
  }

  function handleNoteSaved(comment: string | null) {
    if (!user?.id) return;

    const next = endorsements.map((endorsement) =>
      endorsement.user_id === user.id
        ? {
            ...endorsement,
            comment,
            updated_at: new Date().toISOString(),
          }
        : endorsement
    );
    setEndorsements(next);
    onEndorsementsChange?.(next);
  }

  const count = endorsements.length;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className={cn(
            "flex w-full flex-col gap-0 border-l border-amber-900/20 p-0 sm:max-w-md",
            "bg-gradient-to-b from-stone-950 via-stone-950 to-amber-950/40 text-stone-100"
          )}
        >
          <SheetHeader className="space-y-2 border-b border-amber-500/20 px-6 py-5 pr-12 text-left">
            <SheetTitle className="font-serif text-2xl font-bold tracking-tight text-amber-50">
              Curator Notes
            </SheetTitle>
            <SheetDescription className="text-sm leading-relaxed text-stone-400">
              Max Props endorsements for{" "}
              <span className="font-medium text-stone-300">{threadTitle}</span>
              {count > 0
                ? ` · ${count} ${count === 1 ? "note" : "notes"}`
                : null}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {count === 0 ? (
              <p className="rounded-xl border border-dashed border-amber-500/25 bg-amber-500/5 px-4 py-8 text-center text-sm text-stone-400">
                No Max Props endorsements yet.
              </p>
            ) : (
              <ol className="space-y-4">
                {endorsements.map((endorsement) => {
                  const handle =
                    endorsement.curatorUsername?.trim().replace(/^@+/, "") ||
                    null;
                  const isOwn = Boolean(
                    user?.id && user.id === endorsement.user_id
                  );
                  const comment = endorsement.comment?.trim() || null;

                  return (
                    <li
                      key={endorsement.id}
                      className={cn(
                        "rounded-2xl border border-amber-500/20 bg-white/[0.04] p-4",
                        "shadow-[0_8px_24px_rgba(0,0,0,0.25)]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <CuratorMonogram username={handle} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            {handle ? (
                              <Link
                                href={`/user/${encodeURIComponent(handle)}`}
                                className="truncate text-sm font-semibold text-amber-100 underline-offset-2 hover:underline"
                                onClick={(event) => event.stopPropagation()}
                              >
                                @{handle}
                              </Link>
                            ) : (
                              <span className="text-sm font-semibold text-stone-300">
                                Anonymous curator
                              </span>
                            )}
                            <time
                              dateTime={endorsement.created_at}
                              className="shrink-0 text-xs text-stone-500"
                            >
                              {formatEndorsementDate(endorsement.created_at)}
                            </time>
                          </div>

                          {comment ? (
                            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-200/90">
                              {comment}
                            </p>
                          ) : (
                            <p className="text-sm italic text-stone-500">
                              This curator awarded Max Props without a note.
                            </p>
                          )}

                          {isOwn ? (
                            <div className="pt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  handleEditNote(endorsement.comment)
                                }
                                className="h-8 border-amber-500/40 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20 hover:text-amber-50"
                              >
                                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                                Edit Note
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <CuratorNoteModal
        open={editOpen}
        onOpenChange={handleEditOpenChange}
        threadId={threadId}
        initialComment={editingComment}
        mode="edit"
        onSaved={handleNoteSaved}
      />
    </>
  );
}
