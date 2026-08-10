"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowBigDown, ArrowBigUp } from "lucide-react";

import { castVote } from "@/app/actions/vote";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { VoteTargetType, VoteValue } from "@/lib/types";

interface VoteButtonsProps {
  targetType: VoteTargetType;
  targetId: string;
  initialScore: number;
  userVote: VoteValue | null;
  /** Path passed to `revalidatePath` after voting. */
  revalidatePathName: string;
  className?: string;
}

export function VoteButtons({
  targetType,
  targetId,
  initialScore,
  userVote,
  revalidatePathName,
  className,
}: VoteButtonsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [score, setScore] = useState(initialScore);
  const [currentVote, setCurrentVote] = useState<VoteValue | null>(userVote);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScore(initialScore);
    setCurrentVote(userVote);
  }, [initialScore, userVote]);

  function applyOptimistic(nextValue: VoteValue) {
    setScore((prev) => {
      let next = prev;
      if (currentVote === nextValue) {
        next -= nextValue;
      } else if (currentVote === null) {
        next += nextValue;
      } else {
        next -= currentVote;
        next += nextValue;
      }
      return next;
    });
    setCurrentVote((prev) => (prev === nextValue ? null : nextValue));
  }

  function handleVote(nextValue: VoteValue) {
    if (isPending) return;

    setError(null);
    const previousScore = score;
    const previousVote = currentVote;
    applyOptimistic(nextValue);

    startTransition(async () => {
      const result = await castVote({
        targetType,
        targetId,
        value: nextValue,
        path: revalidatePathName,
      });

      if (!result.success) {
        setScore(previousScore);
        setCurrentVote(previousVote);
        setError(result.error ?? "Failed to cast vote.");
        return;
      }

      setCurrentVote(result.userVote);
      router.refresh();
    });
  }

  return (
    <div
      className={cn("flex flex-col items-center gap-0.5", className)}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-foreground",
          currentVote === 1 && "text-orange-600 hover:text-orange-600"
        )}
        aria-label="Upvote"
        aria-pressed={currentVote === 1}
        disabled={isPending}
        onClick={() => handleVote(1)}
      >
        <ArrowBigUp
          className={cn("h-5 w-5", currentVote === 1 && "fill-current")}
        />
      </Button>

      <span
        className={cn(
          "min-w-[1.5rem] text-center text-sm font-semibold tabular-nums",
          score > 0 && "text-orange-600",
          score < 0 && "text-blue-600"
        )}
        aria-label={`Score ${score}`}
      >
        {score}
      </span>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn(
          "h-8 w-8 text-muted-foreground hover:text-foreground",
          currentVote === -1 && "text-blue-600 hover:text-blue-600"
        )}
        aria-label="Downvote"
        aria-pressed={currentVote === -1}
        disabled={isPending}
        onClick={() => handleVote(-1)}
      >
        <ArrowBigDown
          className={cn("h-5 w-5", currentVote === -1 && "fill-current")}
        />
      </Button>

      {error ? (
        <p className="max-w-[6rem] text-center text-[10px] leading-tight text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
