/**
 * Thread moderation status for public feed visibility.
 * Images require admin review before appearing on Discover.
 */
export type ThreadStatus = "published" | "pending_review";

/** Matches Markdown image tags: ![alt](url) */
export const MARKDOWN_IMAGE_RE = /!\[.*?\]\(.*?\)/;

export const IMAGE_REVIEW_MESSAGE =
  "Your thread contains image content and has been submitted for admin review before appearing on the public feed.";

/**
 * True if any message string (or joined content) contains a Markdown image tag.
 */
export function contentHasMarkdownImages(
  content: string | Array<{ content?: unknown } | string> | null | undefined
): boolean {
  if (typeof content === "string") {
    return MARKDOWN_IMAGE_RE.test(content);
  }

  if (!Array.isArray(content)) return false;

  for (const item of content) {
    if (typeof item === "string") {
      if (MARKDOWN_IMAGE_RE.test(item)) return true;
      continue;
    }
    if (
      item &&
      typeof item === "object" &&
      typeof item.content === "string" &&
      MARKDOWN_IMAGE_RE.test(item.content)
    ) {
      return true;
    }
  }

  return false;
}

export function resolveThreadStatusForContent(
  content: string | Array<{ content?: unknown } | string> | null | undefined
): ThreadStatus {
  return contentHasMarkdownImages(content) ? "pending_review" : "published";
}
