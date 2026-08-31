import {
  collectMessagesFromJson,
  dedupeMessages,
  extractJsonCandidates,
  extractTitle,
  fetchSharePage,
  stripHtml,
} from "../html";
import type { ImportedMessage, ImportedThread } from "../types";
import { ParseError } from "../validate";

export async function parseClaudeShare(
  originalUrl: string
): Promise<ImportedThread> {
  const html = await fetchSharePage(originalUrl);
  const title = extractTitle(html, "Claude Conversation");

  let messages = dedupeMessages(
    extractJsonCandidates(html).flatMap((candidate) =>
      collectMessagesFromJson(candidate)
    )
  );

  if (messages.length === 0) {
    messages = extractClaudeDomMessages(html);
  }

  if (messages.length === 0) {
    throw new ParseError(
      "Could not parse Claude share content. The link may require login or the page structure may have changed."
    );
  }

  return {
    source: "Claude",
    originalUrl,
    title,
    messages,
  };
}

/**
 * Fallback: Claude share pages sometimes render human/assistant blocks
 * with data attributes or role classes in HTML.
 */
function extractClaudeDomMessages(html: string): ImportedMessage[] {
  const messages: ImportedMessage[] = [];

  const roleBlockRegex =
    /data-(?:testid|message-author-role|role)=["'](user|human|assistant|ai)["'][^>]*>([\s\S]*?)(?=data-(?:testid|message-author-role|role)=["'](?:user|human|assistant|ai)["']|<\/main>|$)/gi;

  let match: RegExpExecArray | null;
  while ((match = roleBlockRegex.exec(html)) !== null) {
    const roleRaw = match[1].toLowerCase();
    const content = stripHtml(match[2]);
    if (!content) continue;

    messages.push({
      role: roleRaw === "user" || roleRaw === "human" ? "user" : "assistant",
      content,
    });
  }

  return messages;
}
