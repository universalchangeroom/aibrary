import type { ImportSource, SupportedPlatform } from "./types";

/**
 * Supported share-link patterns (host + path).
 * Matches https://chatgpt.com/share/..., claude.ai/share/..., and
 * perplexity.ai/page/... (including www. variants).
 */
export const SUPPORTED_PLATFORMS: SupportedPlatform[] = [
  {
    source: "ChatGPT",
    hostPattern: /^(?:www\.)?(?:chatgpt\.com|chat\.openai\.com)$/i,
    pathPattern: /^\/share\/[A-Za-z0-9._-]+/i,
  },
  {
    source: "DeepSeek",
    hostPattern: /^(?:www\.)?chat\.deepseek\.com$/i,
    pathPattern: /^\/share\/[A-Za-z0-9._-]+/i,
  },
  {
    source: "Claude",
    hostPattern: /^(?:www\.)?claude\.ai$/i,
    pathPattern: /^\/share\/[A-Za-z0-9._-]+/i,
  },
  {
    source: "Perplexity",
    hostPattern: /^(?:www\.)?perplexity\.ai$/i,
    pathPattern: /^\/page\/[A-Za-z0-9._-]+/i,
  },
];

/** Combined regex for quick validation messages. */
export const SUPPORTED_URL_REGEX =
  /^https?:\/\/(?:www\.)?(?:chatgpt\.com\/share\/|chat\.openai\.com\/share\/|chat\.deepseek\.com\/share\/|claude\.ai\/share\/|perplexity\.ai\/page\/)[A-Za-z0-9._-]+/i;

export class InvalidLinkError extends Error {
  readonly status = 400;

  constructor(message = "Invalid Link") {
    super(message);
    this.name = "InvalidLinkError";
  }
}

export class ParseError extends Error {
  readonly status = 422;

  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

export interface ValidatedShareUrl {
  originalUrl: string;
  source: ImportSource;
  hostname: string;
  pathname: string;
}

/**
 * Validates a raw URL string against supported ChatGPT / Claude / Perplexity
 * share patterns and returns normalized routing metadata.
 */
export function validateShareUrl(raw: unknown): ValidatedShareUrl {
  if (typeof raw !== "string" || !raw.trim()) {
    throw new InvalidLinkError("Invalid Link");
  }

  const trimmed = raw.trim();

  if (!SUPPORTED_URL_REGEX.test(trimmed)) {
    throw new InvalidLinkError("Invalid Link");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidLinkError("Invalid Link");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new InvalidLinkError("Invalid Link");
  }

  const hostname = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname;

  const platform = SUPPORTED_PLATFORMS.find(
    (entry) =>
      entry.hostPattern.test(hostname) && entry.pathPattern.test(pathname)
  );

  if (!platform) {
    throw new InvalidLinkError("Invalid Link");
  }

  return {
    originalUrl: parsed.toString(),
    source: platform.source,
    hostname,
    pathname,
  };
}
