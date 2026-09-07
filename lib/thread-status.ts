/**
 * Thread moderation status for public feed visibility.
 * Images and AI-generated videos require admin review before Discover.
 */
export type ThreadStatus = "published" | "pending_review";

/** Matches Markdown image tags: ![alt](url) */
export const MARKDOWN_IMAGE_RE = /!\[[^\]]*\]\([^)]*\)/;

/**
 * Bookmarklet AI video pseudo-links: [AI Generated Video](https://…).
 * Also matches the bare prefix `[AI Generated Video](` for defense in depth.
 */
export const AI_GENERATED_VIDEO_RE =
  /\[AI Generated Video\]\([^)]*\)|\[AI Generated Video\]\(/i;

export const IMAGE_REVIEW_MESSAGE =
  "Your thread contains image or video content and has been submitted for admin review before appearing on the public feed.";

/** @deprecated Prefer IMAGE_REVIEW_MESSAGE — same copy for media moderation. */
export const MEDIA_REVIEW_MESSAGE = IMAGE_REVIEW_MESSAGE;

function textHasModeratedMedia(text: string): boolean {
  return MARKDOWN_IMAGE_RE.test(text) || AI_GENERATED_VIDEO_RE.test(text);
}

/**
 * True if any message string (or joined content) contains a Markdown image
 * tag or an `[AI Generated Video](…)` link.
 */
export function contentHasMarkdownImages(
  content: string | Array<{ content?: unknown } | string> | null | undefined
): boolean {
  return contentRequiresMediaReview(content);
}

/**
 * True if content includes moderated visual media (images or AI videos).
 */
export function contentRequiresMediaReview(
  content: string | Array<{ content?: unknown } | string> | null | undefined
): boolean {
  if (typeof content === "string") {
    return textHasModeratedMedia(content);
  }

  if (!Array.isArray(content)) return false;

  for (const item of content) {
    if (typeof item === "string") {
      if (textHasModeratedMedia(item)) return true;
      continue;
    }
    if (
      item &&
      typeof item === "object" &&
      typeof item.content === "string" &&
      textHasModeratedMedia(item.content)
    ) {
      return true;
    }
  }

  return false;
}

export function resolveThreadStatusForContent(
  content: string | Array<{ content?: unknown } | string> | null | undefined
): ThreadStatus {
  return contentRequiresMediaReview(content) ? "pending_review" : "published";
}
