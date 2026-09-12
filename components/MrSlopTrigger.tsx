"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { MrSlopFace } from "@/components/MrSlopFace";
import { markSlop } from "@/lib/actions/slop";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface MrSlopTriggerProps {
  threadId: string;
  /** Fired after a successful new mark with the authoritative count. */
  onSlopped?: (slopCount: number) => void;
  className?: string;
  size?: "sm" | "md";
}

/**
 * Concealed dotted-line X that reveals Mr. Slop on hover and increments
 * threads.slop_count once per user when clicked.
 */
export function MrSlopTrigger({
  threadId,
  onSlopped,
  className,
  size = "md",
}: MrSlopTriggerProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [isPending, startTransition] = useTransition();
  const [marked, setMarked] = useState(false);
  const [flash, setFlash] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (isPending || marked) return;

    if (!user) {
      router.push(`/login?next=${encodeURIComponent("/feed")}`);
      return;
    }

    setError(null);
    setFlash(true);
    window.setTimeout(() => setFlash(false), 450);

    startTransition(async () => {
      const result = await markSlop(threadId);
      if (!result.success) {
        setError(result.error);
        return;
      }

      setMarked(true);
      onSlopped?.(result.slopCount);
      router.refresh();
    });
  }

  const boxSize = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={marked ? "Already marked as slop" : "Mark as slop with Mr. Slop"}
        aria-pressed={marked}
        title="Mr. Slop"
        disabled={isPending || marked}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          handleClick();
        }}
        className={cn(
          "group relative flex items-center justify-center rounded-xl border border-dashed border-stone-400/50 p-2 transition-all dark:border-white/30",
          boxSize,
          "hover:border-pink-500/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-400",
          "disabled:cursor-not-allowed",
          marked &&
            "border-lime-400/80 bg-lime-400/10 shadow-[0_0_16px_rgba(57,255,20,0.35)]",
          flash && "scale-110 shadow-[0_0_28px_rgba(57,255,20,0.85)]"
        )}
      >
        <span
          className={cn(
            "font-mono text-sm text-stone-500 transition-all duration-300 dark:text-white/60",
            "group-hover:scale-75 group-hover:opacity-0 group-focus-visible:opacity-0",
            marked && "scale-75 opacity-0"
          )}
          aria-hidden
        >
          X
        </span>

        <span
          className={cn(
            "pointer-events-none absolute inset-0 flex items-center justify-center transition-all duration-300",
            "scale-75 opacity-0",
            "group-hover:scale-100 group-hover:opacity-100 group-focus-visible:scale-100 group-focus-visible:opacity-100",
            marked && "scale-100 opacity-100",
            flash && "animate-pulse"
          )}
        >
          <MrSlopFace className="h-7 w-7" />
        </span>

        <span
          className={cn(
            "pointer-events-none absolute -top-8 left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md border border-lime-400/30 bg-slate-950/95 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-lime-300 opacity-0 shadow-lg transition-opacity duration-200",
            "group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        >
          Mr. Slop
        </span>
      </button>

      {error ? (
        <p
          role="alert"
          className="absolute left-0 top-full z-30 mt-1 max-w-[10rem] text-[10px] leading-tight text-pink-600"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
