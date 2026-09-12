"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { PropsEmojiGrid } from "@/components/feed/props-emoji-grid";
import { HandMeter } from "@/components/HandMeter";
import { MrSlopTrigger } from "@/components/MrSlopTrigger";
import { giveProps, retractProps, toggleStar } from "@/lib/actions/props";
import { PROPS_INFLUENCE_CAP } from "@/lib/props-cap";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

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
  /** Props this viewer has already given to this thread. */
  previouslyGivenProps?: number;
  /** Immediately bump the displayed thread Props total in the parent. */
  onOptimisticPropsGive?: (amount: number) => void;
  /** Roll back an optimistic Props bump if the server action fails. */
  onOptimisticPropsRevert?: (amount: number) => void;
  /** Replace the displayed total with the authoritative server value. */
  onPropsTotalSync?: (total: number) => void;
  /** Optional: sync displayed slop count after marking. */
  onSlopCountSync?: (slopCount: number) => void;
  /** Live public Props tally for the hand meter inside the pane. */
  propsCount?: number;
  /** Live public Slop tally for the hand meter inside the pane. */
  slopCount?: number;
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
  previouslyGivenProps: initialPreviouslyGiven = 0,
  onOptimisticPropsGive,
  onOptimisticPropsRevert,
  onPropsTotalSync,
  onSlopCountSync,
  propsCount = 0,
  slopCount = 0,
}: ThreadActionsProps) {
  const router = useRouter();
  const [isStarPending, startStarTransition] = useTransition();
  const [isPropsPending, startPropsTransition] = useTransition();

  const [starred, setStarred] = useState(initialStarred);
  const [propsOpen, setPropsOpen] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(0);
  const [tokenBalance, setTokenBalance] = useState(initialTokenBalance);
  const [previouslyGiven, setPreviouslyGiven] = useState(
    Math.max(0, Math.floor(initialPreviouslyGiven))
  );
  const [localPropsCount, setLocalPropsCount] = useState(
    Math.max(0, Math.floor(propsCount))
  );
  const [localSlopCount, setLocalSlopCount] = useState(
    Math.max(0, Math.floor(slopCount))
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTokenBalance(initialTokenBalance);
  }, [initialTokenBalance]);

  useEffect(() => {
    setStarred(initialStarred);
  }, [initialStarred]);

  useEffect(() => {
    setPreviouslyGiven(Math.max(0, Math.floor(initialPreviouslyGiven)));
  }, [initialPreviouslyGiven]);

  useEffect(() => {
    setLocalPropsCount(Math.max(0, Math.floor(propsCount)));
  }, [propsCount]);

  useEffect(() => {
    setLocalSlopCount(Math.max(0, Math.floor(slopCount)));
  }, [slopCount]);

  const isAuthenticated = Boolean(currentUserId);
  const isAuthor = Boolean(currentUserId && currentUserId === authorId);
  const balanceKnown = typeof tokenBalance === "number";
  const availableProps = balanceKnown ? Math.max(0, tokenBalance) : 0;
  const remainingInfluence = Math.max(
    0,
    PROPS_INFLUENCE_CAP - previouslyGiven
  );
  const atInfluenceCap = remainingInfluence <= 0;
  /** Grid room: wallet balance capped by Influence Cap headroom. */
  const selectableProps = Math.min(availableProps, remainingInfluence);
  const canGiveProps =
    isAuthenticated &&
    !isAuthor &&
    balanceKnown &&
    selectableProps > 0 &&
    !atInfluenceCap;
  /** Still open the popover at the cap, or when they have gifts to retract. */
  const canOpenPropsPopover =
    isAuthenticated &&
    !isAuthor &&
    (atInfluenceCap ||
      previouslyGiven > 0 ||
      (balanceKnown && availableProps > 0));
  const canRetractProps =
    isAuthenticated && !isAuthor && previouslyGiven > 0 && !isPropsPending;
  const clampedAmount = Math.min(
    Math.max(0, selectedAmount),
    Math.max(0, selectableProps)
  );
  const hasSelectedProps = clampedAmount > 0;

  useEffect(() => {
    if (propsOpen) {
      setSelectedAmount(0);
    }
  }, [propsOpen]);

  useEffect(() => {
    if (selectedAmount > selectableProps && selectableProps > 0) {
      setSelectedAmount(selectableProps);
    }
  }, [selectableProps, selectedAmount]);

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

  function handleQuickProp() {
    if (
      !canGiveProps ||
      isPropsPending ||
      tokenBalance == null ||
      selectableProps < 1
    ) {
      return;
    }

    setError(null);
    const amount = 1;
    const prevBalance = tokenBalance;
    const prevGiven = previouslyGiven;

    onOptimisticPropsGive?.(amount);
    setTokenBalance(Math.max(0, prevBalance - amount));
    setPreviouslyGiven(prevGiven + amount);
    setLocalPropsCount((prev) => prev + amount);

    startPropsTransition(async () => {
      const result = await giveProps(threadId, amount);
      if (!result.success) {
        onOptimisticPropsRevert?.(amount);
        setTokenBalance(prevBalance);
        setPreviouslyGiven(prevGiven);
        setLocalPropsCount((prev) => Math.max(0, prev - amount));
        setError(result.error);
        return;
      }

      onPropsTotalSync?.(result.totalTokens);
      setLocalPropsCount(result.totalTokens);
      setTokenBalance(result.remainingBalance);
      router.refresh();
    });
  }

  function handleGiveProps() {
    if (
      !canGiveProps ||
      isPropsPending ||
      tokenBalance == null ||
      clampedAmount <= 0
    ) {
      return;
    }

    setError(null);
    const amount = clampedAmount;
    const prevBalance = tokenBalance;
    const prevGiven = previouslyGiven;

    onOptimisticPropsGive?.(amount);
    setTokenBalance(Math.max(0, prevBalance - amount));
    setPreviouslyGiven(prevGiven + amount);
    setLocalPropsCount((prev) => prev + amount);

    startPropsTransition(async () => {
      const result = await giveProps(threadId, amount);
      if (!result.success) {
        onOptimisticPropsRevert?.(amount);
        setTokenBalance(prevBalance);
        setPreviouslyGiven(prevGiven);
        setLocalPropsCount((prev) => Math.max(0, prev - amount));
        setError(result.error);
        return;
      }

      onPropsTotalSync?.(result.totalTokens);
      setLocalPropsCount(result.totalTokens);
      setTokenBalance(result.remainingBalance);
      setSelectedAmount(0);
      setPropsOpen(false);
      router.refresh();
    });
  }

  function handleRetractProps() {
    if (!canRetractProps || isPropsPending) return;

    const confirmed = window.confirm(
      "Props are a commitment. If you remove your Props, they will be permanently burned and will NOT be refunded to your balance. Are you sure you want to retract your endorsement?"
    );
    if (!confirmed) return;

    setError(null);
    const burnedAmount = previouslyGiven;

    // Optimistic: drop gifts from the thread total; wallet stays unchanged (burn).
    onOptimisticPropsRevert?.(burnedAmount);
    setPreviouslyGiven(0);
    setSelectedAmount(0);
    setLocalPropsCount((prev) => Math.max(0, prev - burnedAmount));

    startPropsTransition(async () => {
      const result = await retractProps(threadId);
      if (!result.success) {
        onOptimisticPropsGive?.(burnedAmount);
        setPreviouslyGiven(burnedAmount);
        setLocalPropsCount((prev) => prev + burnedAmount);
        setError(result.error);
        return;
      }

      onPropsTotalSync?.(result.totalTokens);
      setLocalPropsCount(result.totalTokens);
      setPreviouslyGiven(0);
      setPropsOpen(false);
    });
  }

  const retractButton =
    previouslyGiven > 0 ? (
      <div className="border-t border-red-800/10 pt-3 dark:border-red-200/10">
        <button
          type="button"
          className="text-sm text-red-500 underline-offset-2 hover:text-red-600 hover:underline disabled:pointer-events-none disabled:opacity-50"
          onClick={handleRetractProps}
          disabled={!canRetractProps || isStarPending}
        >
          {isPropsPending ? "Retracting…" : "Retract my Props"}
        </button>
      </div>
    ) : null;

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
                disabled={
                  !canOpenPropsPopover || isPropsPending || isStarPending
                }
              >
                Giv&apos;m Props!
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[420px] space-y-3 border-red-800/30 bg-stone-50 dark:bg-red-950/20"
            >
              {atInfluenceCap ? (
                <>
                  <p
                    role="status"
                    className="rounded-md border border-amber-200 bg-amber-50 px-4 py-6 text-center text-sm font-medium leading-relaxed text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50"
                  >
                    You&apos;ve given the maximum {PROPS_INFLUENCE_CAP} Props! 🎉
                  </p>
                  {retractButton}
                </>
              ) : (
                <>
                  <div className="flex items-center justify-center rounded-xl border border-stone-200/80 bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-black/20">
                    <HandMeter
                      propsCount={localPropsCount}
                      slopCount={localSlopCount}
                      size="md"
                    />
                  </div>

                  <div className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={handleQuickProp}
                      disabled={
                        !canGiveProps ||
                        selectableProps < 1 ||
                        isPropsPending ||
                        isStarPending
                      }
                      className={cn(
                        "flex flex-1 items-center justify-center gap-2 rounded-xl border border-amber-400/50 bg-amber-400/10 px-3 py-2.5 text-sm font-semibold text-amber-950 transition",
                        "hover:border-amber-300 hover:bg-amber-400/20 hover:shadow-[0_0_16px_rgba(251,191,36,0.35)]",
                        "disabled:cursor-not-allowed disabled:opacity-50 dark:text-amber-100"
                      )}
                    >
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.8)]" />
                      +1 Prop
                    </button>
                    <MrSlopTrigger
                      threadId={threadId}
                      size="sm"
                      className="shrink-0"
                      onSlopped={(nextSlop) => {
                        setLocalSlopCount(nextSlop);
                        onSlopCountSync?.(nextSlop);
                      }}
                    />
                  </div>

                  <div className="mb-4 flex w-full flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-stone-600 dark:text-red-200/80">
                      Available Props: {availableProps}
                    </span>
                    <span className="text-stone-600 dark:text-red-200/80">
                      Influence left: {remainingInfluence}/
                      {PROPS_INFLUENCE_CAP}
                    </span>
                    <span className="font-medium text-stone-900 dark:text-red-50">
                      Selected: {clampedAmount}
                    </span>
                  </div>

                  {selectableProps > 0 ? (
                    <PropsEmojiGrid
                      availableProps={selectableProps}
                      selectedAmount={clampedAmount}
                      onSelect={setSelectedAmount}
                      disabled={
                        !canGiveProps || isPropsPending || isStarPending
                      }
                    />
                  ) : (
                    <p className="text-sm text-stone-600 dark:text-red-200/80">
                      No Props available to give right now.
                    </p>
                  )}

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

                  {retractButton}
                </>
              )}
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
