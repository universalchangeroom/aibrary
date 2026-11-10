"use client";

import { Badge } from "@/components/ui/badge";
import { SourceModelIcon } from "@/components/feed/source-model-icon";
import { sourceModelDisplayName } from "@/lib/share-source-model";
import { cn } from "@/lib/utils";

interface SourceModelBadgeProps {
  sourceModel: string;
  className?: string;
  /** `discover` matches Discover thread-card cyan pills. */
  variant?: "default" | "discover";
}

export function SourceModelBadge({
  sourceModel,
  className,
  variant = "default",
}: SourceModelBadgeProps) {
  const displayName = sourceModelDisplayName(sourceModel);

  if (variant === "discover") {
    return (
      <span
        className={cn(
          "inline-flex max-w-full items-center gap-1 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-2.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide text-cyan-200 shadow-[0_0_12px_rgba(34,211,238,0.25)]",
          className
        )}
      >
        <SourceModelIcon sourceModel={sourceModel} className="h-3.5 w-3.5" />
        <span className="truncate">{displayName}</span>
      </span>
    );
  }

  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      <SourceModelIcon sourceModel={sourceModel} />
      <span>{displayName}</span>
    </Badge>
  );
}
