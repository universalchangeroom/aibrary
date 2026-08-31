import { Bot } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { sourceModelFaviconUrl } from "@/lib/source-model-icon";
import { cn } from "@/lib/utils";

interface SourceModelBadgeProps {
  sourceModel: string;
  className?: string;
}

export function SourceModelBadge({
  sourceModel,
  className,
}: SourceModelBadgeProps) {
  const faviconUrl = sourceModelFaviconUrl(sourceModel);

  return (
    <Badge variant="secondary" className={cn("gap-1.5", className)}>
      {faviconUrl ? (
        <img
          src={faviconUrl}
          alt=""
          width={16}
          height={16}
          className="h-4 w-4 shrink-0 rounded-sm"
          loading="lazy"
        />
      ) : (
        <Bot className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
      )}
      <span>{sourceModel}</span>
    </Badge>
  );
}
