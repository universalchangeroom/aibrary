import { parseChatGPTShareLink } from "./parsers/chatgpt";
import { parseClaudeShare } from "./parsers/claude";
import { parseDeepSeekShare } from "./parsers/deepseek";
import { parsePerplexityShare } from "./parsers/perplexity";
import type { ImportedThread } from "./types";
import { validateShareUrl, type ValidatedShareUrl } from "./validate";

export type { ImportedMessage, ImportedThread, ImportSource } from "./types";
export {
  InvalidLinkError,
  ParseError,
  SUPPORTED_URL_REGEX,
  validateShareUrl,
} from "./validate";
export { parseChatGPTShareLink, parseChatGptShare } from "./parsers/chatgpt";
export { parseDeepSeekShare } from "./parsers/deepseek";

/**
 * Routes a validated share URL to the correct platform parser.
 */
export async function importShareLink(
  validated: ValidatedShareUrl
): Promise<ImportedThread> {
  switch (validated.source) {
    case "ChatGPT":
      return parseChatGPTShareLink(validated.originalUrl);
    case "DeepSeek":
      return parseDeepSeekShare(validated.originalUrl);
    case "Claude":
      return parseClaudeShare(validated.originalUrl);
    case "Perplexity":
      return parsePerplexityShare(validated.originalUrl);
    default: {
      const _exhaustive: never = validated.source;
      throw new Error(`Unhandled source: ${_exhaustive}`);
    }
  }
}

/**
 * Validate + parse a share URL end-to-end.
 */
export async function importLinkFromUrl(url: unknown): Promise<ImportedThread> {
  const validated = validateShareUrl(url);
  return importShareLink(validated);
}
