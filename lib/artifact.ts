/**
 * External artifact linking — types, labels, and URL auto-detection.
 */

export const ARTIFACT_TYPES = [
  "image",
  "video",
  "audio",
  "iframe",
  "link",
] as const;

export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

export const ARTIFACT_TYPE_LABELS: Record<ArtifactType, string> = {
  image: "Image",
  video: "Video",
  audio: "Audio",
  iframe: "Interactive App",
  link: "Link",
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|avif|svg|bmp|ico)(?:\?|#|$)/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|ogv|mov|m4v)(?:\?|#|$)/i;
const AUDIO_EXT = /\.(mp3|wav|ogg|oga|m4a|aac|flac)(?:\?|#|$)/i;

export function isArtifactType(value: unknown): value is ArtifactType {
  return (
    typeof value === "string" &&
    (ARTIFACT_TYPES as readonly string[]).includes(value)
  );
}

/** Infer artifact type from a URL path / common host patterns. */
export function detectArtifactType(url: string): ArtifactType {
  const trimmed = url.trim();
  if (!trimmed) return "link";

  let pathname = trimmed;
  try {
    pathname = new URL(trimmed).pathname;
  } catch {
    // Keep raw string for extension checks.
  }

  if (IMAGE_EXT.test(pathname) || IMAGE_EXT.test(trimmed)) return "image";
  if (VIDEO_EXT.test(pathname) || VIDEO_EXT.test(trimmed)) return "video";
  if (AUDIO_EXT.test(pathname) || AUDIO_EXT.test(trimmed)) return "audio";

  // Common interactive / preview hosts → iframe.
  try {
    const host = new URL(trimmed).hostname.toLowerCase();
    if (
      host.includes("codepen.io") ||
      host.includes("codesandbox.io") ||
      host.includes("stackblitz.com") ||
      host.includes("replit.com") ||
      host.includes("glitch.me") ||
      host.includes("p5js.org")
    ) {
      return "iframe";
    }
  } catch {
    // ignore
  }

  return "link";
}

export function asHttpUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}
