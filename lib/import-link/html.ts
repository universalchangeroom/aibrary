import type { ImportedMessage } from "./types";

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCharCode(Number(code))
    );
}

export function stripHtml(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<\/li>/gi, "\n")
      .replace(/<[^>]+>/g, "")
  )
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractTitle(html: string, fallback: string): string {
  const ogMatch = html.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (ogMatch?.[1]) {
    return decodeHtmlEntities(ogMatch[1]).trim();
  }

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch?.[1]) {
    const cleaned = decodeHtmlEntities(titleMatch[1])
      .replace(/\s*[|\-–—]\s*(ChatGPT|Claude|Perplexity).*$/i, "")
      .trim();
    if (cleaned) return cleaned;
  }

  return fallback;
}

/**
 * Walk nested JSON from share-page payloads and collect chat-like messages.
 */
export function collectMessagesFromJson(
  value: unknown,
  depth = 0
): ImportedMessage[] {
  if (depth > 12 || value == null) return [];

  if (Array.isArray(value)) {
    // Prefer arrays that already look like message lists.
    if (
      value.length > 0 &&
      value.every(
        (item) =>
          item &&
          typeof item === "object" &&
          "role" in item &&
          "content" in item
      )
    ) {
      return value
        .map((item) => normalizeMessage(item as Record<string, unknown>))
        .filter((item): item is ImportedMessage => item !== null);
    }

    return value.flatMap((item) => collectMessagesFromJson(item, depth + 1));
  }

  if (typeof value !== "object") return [];

  const record = value as Record<string, unknown>;
  const direct = normalizeMessage(record);
  if (direct) return [direct];

  // Common Next.js / share-payload shapes
  const candidateKeys = [
    "messages",
    "mapping",
    "conversation",
    "items",
    "turns",
    "entries",
    "content",
    "data",
    "props",
    "pageProps",
    "linear_conversation",
    "chat_messages",
    "chatMessages",
  ];

  const collected: ImportedMessage[] = [];

  for (const key of candidateKeys) {
    if (key in record) {
      collected.push(...collectMessagesFromJson(record[key], depth + 1));
    }
  }

  // ChatGPT mapping: { id: { message: { author: { role }, content: { parts } } } }
  if ("mapping" in record && typeof record.mapping === "object") {
    collected.push(...extractChatGptMapping(record.mapping as Record<string, unknown>));
  }

  if (collected.length > 0) {
    return collected;
  }

  return Object.values(record).flatMap((child) =>
    collectMessagesFromJson(child, depth + 1)
  );
}

function normalizeMessage(
  record: Record<string, unknown>
): ImportedMessage | null {
  const role = extractRole(record);
  const content = extractContent(record);

  if (!role || !content) return null;
  return { role, content };
}

function extractRole(
  record: Record<string, unknown>
): "user" | "assistant" | null {
  const author = record.author;
  if (author && typeof author === "object" && "role" in author) {
    return mapRole(String((author as { role: unknown }).role));
  }

  if (typeof record.role === "string") {
    return mapRole(record.role);
  }

  if (typeof record.sender === "string") {
    return mapRole(record.sender);
  }

  return null;
}

function mapRole(raw: string): "user" | "assistant" | null {
  const role = raw.toLowerCase();
  if (
    role === "user" ||
    role === "human" ||
    role === "you" ||
    role === "prompter"
  ) {
    return "user";
  }
  if (
    role === "assistant" ||
    role === "ai" ||
    role === "bot" ||
    role === "model" ||
    role === "gpt" ||
    role === "claude" ||
    role === "system"
  ) {
    // Drop pure system messages with little value by returning assistant only
    // when not explicitly system-with-empty; system often has boilerplate.
    if (role === "system") return null;
    return "assistant";
  }
  return null;
}

function extractContent(record: Record<string, unknown>): string | null {
  if (typeof record.content === "string") {
    const text = record.content.trim();
    return text || null;
  }

  if (record.content && typeof record.content === "object") {
    const content = record.content as Record<string, unknown>;
    if (Array.isArray(content.parts)) {
      const joined = content.parts
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object" && "text" in part) {
            return String((part as { text: unknown }).text);
          }
          return "";
        })
        .join("\n")
        .trim();
      if (joined) return joined;
    }
    if (typeof content.text === "string" && content.text.trim()) {
      return content.text.trim();
    }
  }

  if (typeof record.text === "string" && record.text.trim()) {
    return record.text.trim();
  }

  if (typeof record.message === "string" && record.message.trim()) {
    return record.message.trim();
  }

  return null;
}

function extractChatGptMapping(
  mapping: Record<string, unknown>
): ImportedMessage[] {
  const nodes = Object.values(mapping)
    .map((node) => {
      if (!node || typeof node !== "object") return null;
      const message = (node as { message?: unknown }).message;
      if (!message || typeof message !== "object") return null;

      const msg = message as Record<string, unknown>;
      const author = msg.author as { role?: string } | undefined;
      const role = author?.role ? mapRole(author.role) : null;
      const content = extractContent(msg);
      const createTime =
        typeof msg.create_time === "number" ? msg.create_time : Number.MAX_SAFE_INTEGER;

      if (!role || !content) return null;
      return { role, content, createTime };
    })
    .filter(
      (item): item is ImportedMessage & { createTime: number } => item !== null
    )
    .sort((a, b) => a.createTime - b.createTime);

  return nodes.map(({ role, content }) => ({ role, content }));
}

/**
 * Try to parse JSON blobs embedded in script tags / bootstrap payloads.
 */
export function extractJsonCandidates(html: string): unknown[] {
  const candidates: unknown[] = [];

  const scriptRegex =
    /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match: RegExpExecArray | null;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      candidates.push(JSON.parse(match[1]));
    } catch {
      // ignore invalid JSON blocks
    }
  }

  const nextDataMatch = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i
  );
  if (nextDataMatch?.[1]) {
    try {
      candidates.push(JSON.parse(nextDataMatch[1]));
    } catch {
      // ignore
    }
  }

  // Inline bootstraps: window.__... = {...}
  const bootstrapRegex =
    /(?:window\.)?(?:__NEXT_DATA__|__remixContext|serverHandoff|initialState|pageProps)\s*=\s*(\{[\s\S]*?\});?\s*(?:<\/script>|$)/gi;
  while ((match = bootstrapRegex.exec(html)) !== null) {
    try {
      candidates.push(JSON.parse(match[1]));
    } catch {
      // ignore
    }
  }

  // Large JSON objects that contain "messages" or "mapping"
  const looseObjectRegex =
    /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*"(?:messages|mapping|chat_messages|linear_conversation)"(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
  const looseMatches = html.match(looseObjectRegex) ?? [];
  for (const blob of looseMatches.slice(0, 8)) {
    try {
      candidates.push(JSON.parse(blob));
    } catch {
      // ignore
    }
  }

  return candidates;
}

export async function fetchSharePage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; ChatShareBot/1.0; +https://chatshare.local)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch share link (HTTP ${response.status}). The page may be private or unavailable.`
    );
  }

  return response.text();
}

export function dedupeMessages(messages: ImportedMessage[]): ImportedMessage[] {
  const seen = new Set<string>();
  const result: ImportedMessage[] = [];

  for (const message of messages) {
    const key = `${message.role}:${message.content}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(message);
  }

  return result;
}
