"use client";

import { useState } from "react";
import {
  Bot,
  Brain,
  CircuitBoard,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import {
  resolveSourceModelPlatform,
  sourceModelFaviconUrl,
  type SourceModelPlatform,
} from "@/lib/source-model-icon";
import { cn } from "@/lib/utils";

/** Lucide stand-ins when favicons are unavailable — swap for brand SVGs later. */
const PLATFORM_FALLBACK_ICON: Record<
  Exclude<SourceModelPlatform, "unknown">,
  LucideIcon
> = {
  chatgpt: Sparkles,
  claude: Brain,
  gemini: Sparkles,
  copilot: CircuitBoard,
  deepseek: Bot,
  grok: Bot,
  "meta-ai": Bot,
  poe: Bot,
  perplexity: Brain,
};

interface SourceModelIconProps {
  sourceModel: string;
  className?: string;
}

/**
 * Platform mark for model pills: Google favicon when known, Lucide fallback otherwise.
 */
export function SourceModelIcon({
  sourceModel,
  className,
}: SourceModelIconProps) {
  const [faviconFailed, setFaviconFailed] = useState(false);
  const faviconUrl = sourceModelFaviconUrl(sourceModel);
  const platform = resolveSourceModelPlatform(sourceModel);
  const FallbackIcon =
    platform === "unknown"
      ? Bot
      : PLATFORM_FALLBACK_ICON[platform];

  if (faviconUrl && !faviconFailed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote favicon; no next/image domain allowlist needed
      <img
        src={faviconUrl}
        alt=""
        width={16}
        height={16}
        className={cn("h-4 w-4 shrink-0 rounded-sm", className)}
        loading="lazy"
        onError={() => setFaviconFailed(true)}
      />
    );
  }

  return (
    <FallbackIcon
      className={cn("h-4 w-4 shrink-0 opacity-90", className)}
      aria-hidden
    />
  );
}
