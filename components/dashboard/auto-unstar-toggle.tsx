"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { setAutoUnstarPreference } from "@/lib/actions/preferences";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AutoUnstarToggleProps {
  initialAutoUnstar: boolean;
}

export function AutoUnstarToggle({
  initialAutoUnstar,
}: AutoUnstarToggleProps) {
  const [enabled, setEnabled] = useState(initialAutoUnstar);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleToggle() {
    if (isPending) return;
    setError(null);
    const previous = enabled;
    const next = !enabled;
    setEnabled(next);

    startTransition(async () => {
      const result = await setAutoUnstarPreference(next);
      if (!result.success) {
        setEnabled(previous);
        setError(result.error);
        return;
      }
      setEnabled(result.autoUnstar);
    });
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div className="space-y-1">
        <h2 className="text-sm font-semibold">
          Automatically remove chats from Starred folder after giving Props.
        </h2>
        <p className="text-xs text-muted-foreground">
          When enabled, starring is treated as a reading queue and completed
          items are removed after you contribute Props.
        </p>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={handleToggle}
        disabled={isPending}
        aria-pressed={enabled}
        className="gap-3"
      >
        <span
          className={cn(
            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
            enabled ? "bg-primary" : "bg-muted"
          )}
        >
          <span
            className={cn(
              "inline-block h-5 w-5 transform rounded-full bg-background transition-transform",
              enabled ? "translate-x-5" : "translate-x-1"
            )}
          />
        </span>
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : enabled ? (
          "Enabled"
        ) : (
          "Disabled"
        )}
      </Button>

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
