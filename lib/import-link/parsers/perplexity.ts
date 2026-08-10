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

export async function parsePerplexityShare(
  originalUrl: string
): Promise<ImportedThread> {
  const html = await fetchSharePage(originalUrl);
  const title = extractTitle(html, "Perplexity Conversation");

  let messages = dedupeMessages(
    extractJsonCandidates(html).flatMap((candidate) =>
      collectMessagesFromJson(candidate)
    )
  );

  if (messages.length === 0) {
    messages = extractPerplexityDomMessages(html);
  }

  if (messages.length === 0) {
    throw new ParseError(
      "Could not parse Perplexity share content. The link may require login or the page structure may have changed."
    );
  }

  return {
    source: "Perplexity",
    originalUrl,
    title,
    messages,
  };
}

function extractPerplexityDomMessages(html: string): ImportedMessage[] {
  const messages: ImportedMessage[] = [];

  // Question / answer style blocks commonly embedded in Perplexity pages.
  const queryMatch = html.match(
    /<(?:h1|div)[^>]*(?:query|question|prompt)[^>]*>([\s\S]*?)<\/(?:h1|div)>/i
  );
  if (queryMatch?.[1]) {
    const content = stripHtml(queryMatch[1]);
    if (content) {
      messages.push({ role: "user", content });
    }
  }

  const answerMatch = html.match(
    /<(?:div|article|section)[^>]*(?:answer|prose|markdown)[^>]*>([\s\S]*?)<\/(?:div|article|section)>/i
  );
  if (answerMatch?.[1]) {
    const content = stripHtml(answerMatch[1]);
    if (content) {
      messages.push({ role: "assistant", content });
    }
  }

  return messages;
}
