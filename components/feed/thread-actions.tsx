"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { PropsEmojiGrid } from "@/components/feed/props-emoji-grid";
import { giveProps, toggleStar } from "@/lib/actions/props";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ThreadActionsProps {
  threadId: string;
  authorId: string;
  currentUserId: string | null;
  /**
   * Server-fetched viewer balance from `ensureViewerPropsBalance`.
   * `null` only when ensure failed for an authenticated user.
   */
  tokenBalance: number | null;
  starred: boolean;
  /** Immediately bump the displayed thread Props total in the parent. */
  onOptimisticPropsGive?: (amount: number) => void;
  /** Roll back an optimistic Props bump if the server action fails. */
  onOptimisticPropsRevert?: (amount: number) => void;
  /** Replace the displayed total with the authoritative server value. */
  onPropsTotalSync?: (total: number) => void;
}

const propsButtonClassName =
  "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-600";

const confirmButtonClassName =
  "w-fit border-transparent bg-red-800 text-white shadow-sm hover:bg-red-900 focus-visible:ring-red-800 disabled:cursor-not-allowed disabled:bg-gray-300 disabled:text-gray-500 dark:disabled:bg-gray-700 dark:disabled:text-gray-500";

/**
 * Compact thread actions for the thread page header (star + give Props).
 * Balance/starred/total come from the Server Component as props.
 */
export function ThreadActions({
  threadId,
  authorId,
  currentUserId,
  tokenBalance: initialTokenBalance,
  starred: initialStarred,
  onOptimisticPropsGive,
  onOptimisticPropsRevert,
  onPropsTotalSync,
}: ThreadActionsProps) {
  const router = useRouter();
  const [isStarPending, startStarTransition] = useTransition();
  const [isPropsPending, startPropsTransition] = useTransition();

  const [starred, setStarred] = useState(initialStarred);
  const [propsOpen, setPropsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(initialTokenBalance);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTokenBalance(initialTokenBalance);
  }, [initialTokenBalance]);

  useEffect(() => {
    setStarred(initialStarred);
  }, [initialStarred]);

  const isAuthenticated = Boolean(currentUserId);
  const isAuthor = Boolean(currentUserId && currentUserId === authorId);
  const balanceKnown = typeof tokenBalance === "number";
  const availableProps = balanceKnown ? Math.max(0, tokenBalance) : 0;
  const canGiveProps =
    isAuthenticated && !isAuthor && balanceKnown && availableProps > 0;
  const clampedAmount = Math.min(
    Math.max(0, selectedAmount),
    Math.max(0, availableProps)
  );
  const hasSelectedProps = clampedAmount > 0;

  useEffect(() => {
    if (propsOpen) {
      setSelectedAmount(0);
    }
  }, [propsOpen]);

  useEffect(() => {
    if (selectedAmount > availableProps && availableProps > 0) {
      setSelectedAmount(availableProps);
    }
  }, [availableProps, selectedAmount]);

  function handleToggleStar() {
    if (!isAuthenticated || isStarPending) return;

    setError(null);
    const previous = starred;
    setStarred((prev) => !prev);

    startStarTransition(async () => {
      const result = await toggleStar(threadId);
      if (!result.success) {
        setStarred(previous);
        setError(result.error);
        return;
      }

      setStarred(result.starred);
      router.refresh();
    });
  }

  function handleGiveProps() {
    if (!canGiveProps || isPropsPending || tokenBalance == null || clampedAmount <= 0) {
      return;
    }

    setError(null);
    const amount = clampedAmount;
    const prevBalance = tokenBalance;

    onOptimisticPropsGive?.(amount);
    setTokenBalance(Math.max(0, prevBalance - amount));

    startPropsTransition(async () => {
      const result = await giveProps(threadId, amount);
      if (!result.success) {
        onOptimisticPropsRevert?.(amount);
        setTokenBalance(prevBalance);
        setError(result.error);
        return;
      }

      onPropsTotalSync?.(result.totalTokens);
      setTokenBalance(result.remainingBalance);
      setSelectedAmount(0);
      setPropsOpen(false);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant={starred ? "default" : "outline"}
          size="icon"
          onClick={handleToggleStar}
          disabled={!isAuthenticated || isStarPending || isPropsPending}
          aria-pressed={starred}
          aria-label={starred ? "Unstar thread" : "Star thread"}
        >
          {isStarPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Star className={starred ? "h-4 w-4 fill-current" : "h-4 w-4"} />
          )}
        </Button>

        {!isAuthor ? (
          <Popover open={propsOpen} onOpenChange={setPropsOpen}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="sm"
                className={propsButtonClassName}
                disabled={!canGiveProps || isPropsPending || isStarPending}
              >
                Giv&apos;m Props!
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[420px] space-y-3 border-red-800/30 bg-stone-50 dark:bg-red-950/20"
            >
              <div className="mb-4 flex w-full items-center justify-between text-xs">
                <span className="text-stone-600 dark:text-red-200/80">
                  Available Props: {availableProps}
                </span>
                <span className="font-medium text-stone-900 dark:text-red-50">
                  Selected: {clampedAmount}
                </span>
              </div>

              <PropsEmojiGrid
                availableProps={availableProps}
                selectedAmount={clampedAmount}
                onSelect={setSelectedAmount}
                disabled={!canGiveProps || isPropsPending || isStarPending}
              />

              <div className="flex justify-end">
                <Button
                  type="button"
                  className={confirmButtonClassName}
                  onClick={handleGiveProps}
                  disabled={
                    !canGiveProps ||
                    !hasSelectedProps ||
                    isPropsPending ||
                    isStarPending
                  }
                >
                  {isPropsPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Confirm
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="max-w-xs text-right text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
