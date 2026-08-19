"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, Star } from "lucide-react";
import { useRouter } from "next/navigation";

import { giveProps, toggleStar } from "@/lib/actions/props";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ThreadActionsProps {
  threadId: string;
  authorId: string;
  currentUserId: string | null;
  initialTotalTokens: number;
  initialTokenBalance: number | null;
  initialStarred: boolean;
}

export function ThreadActions({
  threadId,
  authorId,
  currentUserId,
  initialTotalTokens,
  initialTokenBalance,
  initialStarred,
}: ThreadActionsProps) {
  const router = useRouter();
  const [isStarPending, startStarTransition] = useTransition();
  const [isPropsPending, startPropsTransition] = useTransition();
  const [starred, setStarred] = useState(initialStarred);
  const [propsAmount, setPropsAmount] = useState(1);
  const [tokenBalance, setTokenBalance] = useState(initialTokenBalance ?? 0);
  const [totalTokens, setTotalTokens] = useState(initialTotalTokens);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStarred(initialStarred);
  }, [initialStarred]);

  useEffect(() => {
    setTokenBalance(initialTokenBalance ?? 0);
  }, [initialTokenBalance]);

  useEffect(() => {
    setTotalTokens(initialTotalTokens);
  }, [initialTotalTokens]);

  const isAuthenticated = Boolean(currentUserId);
  const isAuthor = Boolean(currentUserId && currentUserId === authorId);
  const maxProps = Math.max(0, tokenBalance);
  const canGiveProps = isAuthenticated && !isAuthor && maxProps > 0;
  const clampedAmount = Math.min(Math.max(1, propsAmount), Math.max(1, maxProps));

  const helperText = useMemo(() => {
    if (!isAuthenticated) return "Sign in to star threads and give Props.";
    if (isAuthor) return "You cannot give Props to your own chat.";
    if (maxProps <= 0) return "No Props available right now.";
    return `Available Props: ${maxProps}`;
  }, [isAuthenticated, isAuthor, maxProps]);

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
    if (!canGiveProps || isPropsPending) return;

    setError(null);
    const amount = clampedAmount;
    const prevBalance = tokenBalance;
    const prevTotal = totalTokens;

    setTokenBalance((prev) => Math.max(0, prev - amount));
    setTotalTokens((prev) => prev + amount);

    startPropsTransition(async () => {
      const result = await giveProps(threadId, amount);
      if (!result.success) {
        setTokenBalance(prevBalance);
        setTotalTokens(prevTotal);
        setError(result.error);
        return;
      }

      setTokenBalance(result.remainingBalance);
      setTotalTokens(result.totalTokens);
      setPropsAmount(1);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border bg-muted/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Thread Actions</p>
        <p className="text-sm font-semibold text-primary">
          Props: <span className="text-lg">{totalTokens}</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant={starred ? "default" : "outline"}
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
          {starred ? "Starred" : "Star"}
        </Button>
      </div>

      {!isAuthor ? (
        <div className="mt-4 space-y-3">
          <Label htmlFor="give-props-range" className="text-sm">
            Give Props
          </Label>
          <Input
            id="give-props-range"
            type="range"
            min={1}
            max={Math.max(1, maxProps)}
            value={clampedAmount}
            onChange={(event) => setPropsAmount(Number(event.target.value))}
            disabled={!canGiveProps || isPropsPending || isStarPending}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              max={Math.max(1, maxProps)}
              value={clampedAmount}
              onChange={(event) => {
                const next = Number(event.target.value);
                if (Number.isFinite(next)) setPropsAmount(next);
              }}
              disabled={!canGiveProps || isPropsPending || isStarPending}
              className="w-24"
            />
            <Button
              type="button"
              onClick={handleGiveProps}
              disabled={!canGiveProps || isPropsPending || isStarPending}
            >
              {isPropsPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Giv&apos;m props!
            </Button>
          </div>
        </div>
      ) : null}

      <p className="mt-3 text-xs text-muted-foreground">{helperText}</p>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </section>
  );
}
