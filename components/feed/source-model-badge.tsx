"use client";

import { Badge } from "@/components/ui/badge";
import { SourceModelIcon } from "@/components/feed/source-model-icon";
import { sourceModelDisplayName } from "@/lib/share-source-model";
import { cn } from "@/lib/utils";

interface SourceModelBadgeProps {
  sourceModel: string;
  className?: string;
}

export function SourceModelBadge({
  sourceModel,
  className,
}: SourceModelBadgeProps) {
  const displayName = sourceModelDisplayName(sourceModel);

  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      <SourceModelIcon sourceModel={sourceModel} />
      <span>{displayName}</span>
    </Badge>
  );
}
