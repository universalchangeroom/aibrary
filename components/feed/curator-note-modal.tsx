"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  getMyMaxPropsEndorsement,
  publishMaxPropsCuratorNote,
} from "@/lib/actions/props";
import { MAX_PROPS_ENDORSEMENT_COMMENT_LENGTH } from "@/lib/props-cap";
import { cn } from "@/lib/utils";

interface CuratorNoteModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
  /** Prefill when opening right after Max Props unlock (optional). */
  initialComment?: string | null;
  /** `edit` softens copy for updating an existing note from the drawer. */
  mode?: "create" | "edit";
  onSaved?: (comment: string | null) => void;
}

function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/**
 * Editorial dialog for the optional Max Props curator note
 * ("Generosification par excellence").
 */
export function CuratorNoteModal({
  open,
  onOpenChange,
  threadId,
  initialComment = null,
  mode = "create",
  onSaved,
}: CuratorNoteModalProps) {
  const [comment, setComment] = useState(initialComment ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isEdit = mode === "edit";

  useEffect(() => {
    if (!open) return;

    setError(null);
    setComment(initialComment ?? "");
    setIsLoading(true);

    let cancelled = false;
    void (async () => {
      const result = await getMyMaxPropsEndorsement(threadId);
      if (cancelled) return;

      if (result.success && result.comment != null) {
        setComment(result.comment);
      } else if (initialComment) {
        setComment(initialComment);
      }

      setIsLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [open, threadId, initialComment]);

  const charCount = comment.length;
  const wordCount = countWords(comment);
  const overLimit = charCount > MAX_PROPS_ENDORSEMENT_COMMENT_LENGTH;
  const nearLimit =
    charCount >= Math.floor(MAX_PROPS_ENDORSEMENT_COMMENT_LENGTH * 0.9);

  function handleSkip() {
    onOpenChange(false);
  }

  function handlePublish() {
    if (isPending || overLimit) return;

    setError(null);
    startTransition(async () => {
      const result = await publishMaxPropsCuratorNote(threadId, comment);
      if (!result.success) {
        setError(result.error);
        return;
      }
      onSaved?.(result.comment);
      onOpenChange(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[60] max-h-[min(90vh,40rem)] max-w-lg overflow-y-auto border-orange-200/80 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-50 text-stone-800 shadow-xl sm:rounded-xl">
        <DialogHeader className="space-y-2 text-left">
          <DialogTitle className="font-serif text-2xl font-bold tracking-tight text-stone-900">
            Generosification par excellence
          </DialogTitle>
          <DialogDescription className="text-base leading-relaxed text-stone-600">
            {isEdit
              ? "Update your exclusive curator note. Your Max Props endorsement stays attached to this thread."
              : "You\u2019ve awarded Max Props! Leave an exclusive curator note to accompany your endorsement."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label htmlFor="curator-note" className="sr-only">
            Curator note
          </label>
          <Textarea
            id="curator-note"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={isLoading || isPending}
            placeholder="What made this thread worth Max Props? Share your curator's take…"
            maxLength={MAX_PROPS_ENDORSEMENT_COMMENT_LENGTH}
            className={cn(
              "min-h-[11rem] resize-y border-orange-200/80 bg-white/90 text-stone-800 placeholder:text-stone-400",
              "focus-visible:ring-amber-500/60"
            )}
          />
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
            <span>~{wordCount.toLocaleString()} words</span>
            <span
              className={cn(
                overLimit
                  ? "font-medium text-red-700"
                  : nearLimit
                    ? "font-medium text-amber-800"
                    : "text-stone-500"
              )}
            >
              {charCount.toLocaleString()} /{" "}
              {MAX_PROPS_ENDORSEMENT_COMMENT_LENGTH.toLocaleString()}
            </span>
          </div>
        </div>

        {error ? (
          <p role="alert" className="text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={handleSkip}
            disabled={isPending}
            className="text-stone-600 hover:bg-white/60 hover:text-stone-900"
          >
            {isEdit ? "Cancel" : "Skip for now"}
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPending || isLoading || overLimit}
            className="bg-amber-800 text-amber-50 shadow-sm hover:bg-amber-900 focus-visible:ring-amber-800"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isEdit ? "Save Curator Note" : "Publish Curator Note"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
