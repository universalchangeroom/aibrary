import type { ImportedMessage, ImportedThread } from "../types";
import { ParseError } from "../validate";
import { parseDeepSeekShareLink as parseDeepSeekViaService } from "../../../parserService.js";

/**
 * Fetch and normalize a public DeepSeek share URL via parserService
 * (direct fetch + proxy fallbacks + anti-bot messaging).
 */
export async function parseDeepSeekShare(url: string): Promise<ImportedThread> {
  try {
    const data = await parseDeepSeekViaService(url);
    const messages = (data?.messages ?? []).filter(
      (m: ImportedMessage) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    ) as ImportedMessage[];

    if (messages.length === 0) {
      throw new ParseError(
        "DeepSeek share link loaded, but no conversation messages were found. Try the Paste Text tab with a copy of the chat."
      );
    }

    return {
      source: "DeepSeek",
      originalUrl: url,
      title:
        (typeof data.title === "string" && data.title.trim()) ||
        "Imported DeepSeek Thread",
      messages,
    };
  } catch (error) {
    if (error instanceof ParseError) throw error;
    throw new ParseError(
      error instanceof Error
        ? error.message
        : "Failed to parse DeepSeek share link. Use the Paste Text tab if the link is blocked."
    );
  }
}
