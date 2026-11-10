"use client";

import { ExternalLink } from "lucide-react";

import {
  ARTIFACT_TYPE_LABELS,
  asHttpUrl,
  detectArtifactType,
  isArtifactType,
  type ArtifactType,
} from "@/lib/artifact";
import { cn } from "@/lib/utils";

type ArtifactShowcaseProps = {
  url: string | null | undefined;
  type?: string | null;
  /** Match expanded glass card reading surface. */
  tone?: "default" | "glass";
  className?: string;
};

function resolveType(url: string, type: string | null | undefined): ArtifactType {
  if (isArtifactType(type)) return type;
  return detectArtifactType(url);
}

/**
 * Renders an external AI artifact (image / video / audio / interactive iframe)
 * above the chat transcript on the thread detail page.
 */
export function ArtifactShowcase({
  url,
  type,
  tone = "default",
  className,
}: ArtifactShowcaseProps) {
  const safeUrl = asHttpUrl(url);
  if (!safeUrl) return null;

  const kind = resolveType(safeUrl, type);
  const isGlass = tone === "glass";
  const frameClass = isGlass
    ? "border-white/15 bg-black/30"
    : "border-border bg-muted/30";

  return (
    <section
      className={cn("space-y-3", className)}
      aria-label={`${ARTIFACT_TYPE_LABELS[kind]} artifact`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.14em]",
            isGlass ? "text-amber-200/80" : "text-muted-foreground"
          )}
        >
          Artifact · {ARTIFACT_TYPE_LABELS[kind]}
        </h2>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline",
            isGlass ? "text-cyan-300/90 hover:text-cyan-200" : "text-primary"
          )}
        >
          Open original
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </div>

      {kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary external artifact hosts
        <img
          src={safeUrl}
          alt="Shared artifact"
          className={cn(
            "mx-auto max-h-[min(70vh,36rem)] w-full rounded-xl border object-contain",
            frameClass
          )}
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : null}

      {kind === "video" ? (
        <video
          src={safeUrl}
          controls
          playsInline
          className={cn(
            "mx-auto max-h-[min(70vh,36rem)] w-full rounded-xl border object-contain",
            frameClass
          )}
          preload="metadata"
        >
          <a href={safeUrl} target="_blank" rel="noopener noreferrer">
            Download video
          </a>
        </video>
      ) : null}

      {kind === "audio" ? (
        <div
          className={cn(
            "rounded-xl border px-4 py-5",
            frameClass
          )}
        >
          <audio src={safeUrl} controls className="w-full" preload="metadata">
            <a href={safeUrl} target="_blank" rel="noopener noreferrer">
              Download audio
            </a>
          </audio>
        </div>
      ) : null}

      {kind === "iframe" ? (
        <div
          className={cn(
            "overflow-hidden rounded-xl border aspect-video w-full",
            frameClass
          )}
        >
          <iframe
            src={safeUrl}
            title="Interactive artifact"
            className="h-full w-full border-0"
            loading="lazy"
            referrerPolicy="no-referrer"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
          />
        </div>
      ) : null}

      {kind === "link" ? (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm font-medium transition",
            isGlass
              ? "border-white/15 bg-white/5 text-cyan-100 hover:bg-white/10"
              : "border-border bg-card text-foreground hover:bg-muted/50"
          )}
        >
          <span className="min-w-0 truncate">{safeUrl}</span>
          <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        </a>
      ) : null}
    </section>
  );
}
