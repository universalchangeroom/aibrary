import { asChatMessages, type ChatMessage } from "@/lib/types";

/**
 * Minimal thread shape accepted by the export helper.
 * Matches DB threads plus optional original share URL fields.
 */
export type ThreadMarkdownSource = {
  title?: string | null;
  source_model?: string | null;
  tags?: string[] | null;
  content?: ChatMessage[] | unknown;
  /** Optional original share link (schema or client alias). */
  original_url?: string | null;
  originalUrl?: string | null;
};

function normalizeWhitespace(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

/**
 * Normalize spacing so fenced code, lists, and multi-paragraph turns
 * remain valid, readable Markdown.
 */
export function cleanMarkdownTurnContent(raw: string): string {
  let text = normalizeWhitespace(String(raw ?? "")).trim();
  if (!text) return "";

  // Collapse 3+ blank lines to a single blank line between blocks.
  text = text.replace(/\n{3,}/g, "\n\n");

  // Ensure blank lines around fenced code blocks.
  text = text.replace(/([^\n])\n(```[\w+-]*)/g, "$1\n\n$2");
  text = text.replace(/(```)\n([^\n`])/g, "$1\n\n$2");

  // Ensure a blank line before lists that start mid-turn.
  text = text.replace(/([^\n])\n([-*+] |\d+\. )/g, "$1\n\n$2");

  // Trim trailing spaces on each line (keep fence internals untouched as much as possible).
  text = text
    .split("\n")
    .map((line) => {
      if (line.trimStart().startsWith("```")) return line.trimEnd();
      return line.replace(/[ \t]+$/g, "");
    })
    .join("\n");

  return text.trim();
}

function formatTags(tags: string[] | null | undefined): string {
  if (!Array.isArray(tags) || tags.length === 0) return "—";

  const chips = tags
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .map((tag) => {
      const slug = tag.replace(/^#/, "").replace(/\s+/g, "-");
      return `#${slug}`;
    });

  return chips.length > 0 ? chips.join(" ") : "—";
}

function resolveOriginalLink(thread: ThreadMarkdownSource): string | null {
  const raw = thread.original_url ?? thread.originalUrl;
  if (typeof raw !== "string") return null;
  const url = raw.trim();
  return url || null;
}

function formatMessageSection(
  message: ChatMessage,
  sourceModel: string
): string | null {
  const body = cleanMarkdownTurnContent(message.content);
  if (!body) return null;

  if (message.role === "user") {
    return `### User\n\n${body}`;
  }

  if (message.role === "assistant") {
    return `### AI (${sourceModel})\n\n${body}`;
  }

  if (message.role === "system") {
    return `### System\n\n${body}`;
  }

  return null;
}

/**
 * Serialize a published thread into a clean, standard Markdown document.
 */
export function generateThreadMarkdown(thread: ThreadMarkdownSource): string {
  const title =
    typeof thread.title === "string" && thread.title.trim()
      ? thread.title.trim()
      : "Untitled Thread";
  const sourceModel =
    typeof thread.source_model === "string" && thread.source_model.trim()
      ? thread.source_model.trim()
      : "Unknown";
  const tagsLine = formatTags(thread.tags);
  const originalLink = resolveOriginalLink(thread);
  const messages = asChatMessages(thread.content);

  const headerLines = [
    `# ${title}`,
    "",
    `**Source Model:** ${sourceModel}  `,
    `**Tags:** ${tagsLine}  `,
  ];

  if (originalLink) {
    headerLines.push(`**Original Link:** ${originalLink}  `);
  }

  headerLines.push("**Exported from ChatShare**", "", "---", "");

  const bodyParts: string[] = [];
  for (const message of messages) {
    const section = formatMessageSection(message, sourceModel);
    if (!section) continue;
    bodyParts.push(section);
  }

  const body =
    bodyParts.length > 0
      ? bodyParts.join("\n\n---\n\n")
      : "_No messages in this thread._";

  return `${headerLines.join("\n")}${body}\n`;
}
