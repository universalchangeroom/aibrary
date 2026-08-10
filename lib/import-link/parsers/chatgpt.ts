import axios, { AxiosError, type AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";

import type { ImportedMessage, ImportedThread } from "../types";
import { ParseError } from "../validate";

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
} as const;

const PRIVATE_OR_DELETED_PATTERNS = [
  /conversation not found/i,
  /this conversation is private/i,
  /this shared link is no longer available/i,
  /shared conversation not found/i,
  /unable to load conversation/i,
  /share link.*(deleted|removed|expired|invalid|private|unavailable)/i,
  /page not found/i,
  /404/i,
  /access denied/i,
  /link has expired/i,
  /no longer shared/i,
  /no longer available/i,
  /you do not have access/i,
  /doesn't exist/i,
  /does not exist/i,
];

type CheerioRoot = cheerio.CheerioAPI;

/**
 * Fetch a public ChatGPT share page and extract conversation turns,
 * preserving raw Markdown for code blocks and tables when possible.
 *
 * Prefer embedded JSON (`__NEXT_DATA__` / hydration state). Falls back to
 * server-rendered DOM when embedded state is unavailable.
 */
export async function parseChatGPTShareLink(
  url: string
): Promise<ImportedThread> {
  const html = await fetchChatGptShareHtml(url);
  const $ = cheerio.load(html);

  assertShareIsAccessible($, html, url);

  const title = extractPageTitle($);
  const messages =
    extractMessagesFromEmbeddedState($, html) ??
    extractMessagesFromServerRenderedDom($);

  if (!messages || messages.length === 0) {
    throw new ParseError(
      "Could not extract conversation turns from this ChatGPT share link. The page structure may have changed, or the conversation body was not present in the HTML."
    );
  }

  return {
    source: "ChatGPT",
    originalUrl: url,
    title,
    messages: dedupeMessages(messages),
  };
}

/** Kept for callers that used the earlier camel-cased export. */
export const parseChatGptShare = parseChatGPTShareLink;

async function fetchChatGptShareHtml(url: string): Promise<string> {
  let response: AxiosResponse<string>;

  try {
    response = await axios.get<string>(url, {
      headers: BROWSER_HEADERS,
      timeout: 20_000,
      maxRedirects: 5,
      responseType: "text",
      // Always read body so we can inspect soft-404 / private messages.
      validateStatus: () => true,
    });
  } catch (error) {
    throw mapNetworkError(error, url);
  }

  const { status, data: html } = response;

  if (status === 404 || status === 410) {
    throw new ParseError(
      "This ChatGPT share link was not found. It may have been deleted or the ID is invalid."
    );
  }

  if (status === 401 || status === 403) {
    throw new ParseError(
      "This ChatGPT share link is private or restricted. Only public share links can be imported."
    );
  }

  if (status >= 500) {
    throw new ParseError(
      `ChatGPT is temporarily unavailable (HTTP ${status}). Please try again later.`
    );
  }

  if (status < 200 || status >= 300) {
    throw new ParseError(
      `Failed to fetch ChatGPT share link (HTTP ${status}). The link may be private, deleted, or blocked.`
    );
  }

  if (typeof html !== "string" || html.trim().length === 0) {
    throw new ParseError(
      "ChatGPT returned an empty response for this share link."
    );
  }

  return html;
}

function mapNetworkError(error: unknown, url: string): ParseError {
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError;

    if (axiosError.code === "ECONNABORTED") {
      return new ParseError(
        "Timed out while fetching the ChatGPT share link. Please try again."
      );
    }

    if (axiosError.response) {
      const status = axiosError.response.status;
      if (status === 404 || status === 410) {
        return new ParseError(
          "This ChatGPT share link was not found. It may have been deleted or the ID is invalid."
        );
      }
      if (status === 401 || status === 403) {
        return new ParseError(
          "This ChatGPT share link is private or restricted. Only public share links can be imported."
        );
      }
    }

    if (
      axiosError.code === "ENOTFOUND" ||
      axiosError.code === "ECONNREFUSED" ||
      axiosError.code === "EAI_AGAIN"
    ) {
      return new ParseError(
        `Could not reach ChatGPT while fetching ${url}. Check your network connection and try again.`
      );
    }

    return new ParseError(
      axiosError.message ||
        "Network error while fetching the ChatGPT share link."
    );
  }

  if (error instanceof Error) {
    return new ParseError(error.message);
  }

  return new ParseError("Unexpected error while fetching the ChatGPT share link.");
}

function assertShareIsAccessible(
  $: CheerioRoot,
  html: string,
  url: string
): void {
  const titleText = $("title").first().text().trim();
  const bodyText = $("body").text().replace(/\s+/g, " ").trim().slice(0, 4000);
  const haystack = `${titleText}\n${bodyText}\n${html.slice(0, 20_000)}`;

  for (const pattern of PRIVATE_OR_DELETED_PATTERNS) {
    if (pattern.test(haystack)) {
      if (/private|access|restricted|forbidden/i.test(pattern.source)) {
        throw new ParseError(
          "This ChatGPT share link is private or restricted. Only public share links can be imported."
        );
      }
      if (/deleted|removed|expired|no longer|not found|doesn't exist|does not exist/i.test(
        pattern.source
      )) {
        throw new ParseError(
          "This ChatGPT share link is no longer available. It may have been deleted, expired, or unpublished by the owner."
        );
      }
      throw new ParseError(
        "This ChatGPT share link could not be opened. It may be private, deleted, or invalid."
      );
    }
  }

  // Soft empty shells often indicate client-only pages with no payload yet.
  const hasNextData = $('script#__NEXT_DATA__').length > 0;
  const hasConversationHints =
    /"mapping"\s*:/.test(html) ||
    /data-message-author-role/i.test(html) ||
    /"serverResponse"\s*:/.test(html);

  if (!hasNextData && !hasConversationHints && bodyText.length < 120) {
    throw new ParseError(
      `The share page at ${url} did not include readable conversation content. The link may be private, deleted, or blocked from scrapers.`
    );
  }
}

function extractPageTitle($: CheerioRoot): string {
  const ogTitle = $('meta[property="og:title"]').attr("content")?.trim();
  if (ogTitle) return cleanTitle(ogTitle);

  const documentTitle = $("title").first().text().trim();
  if (documentTitle) return cleanTitle(documentTitle);

  return "ChatGPT Conversation";
}

function cleanTitle(raw: string): string {
  return raw
    .replace(/\s*[|\-–—]\s*ChatGPT\s*$/i, "")
    .replace(/\s*·\s*ChatGPT\s*$/i, "")
    .trim() || "ChatGPT Conversation";
}

function extractMessagesFromEmbeddedState(
  $: CheerioRoot,
  html: string
): ImportedMessage[] | null {
  const payloads = collectEmbeddedJsonPayloads($, html);
  const allMessages: ImportedMessage[] = [];

  for (const payload of payloads) {
    allMessages.push(...extractTurnsFromPayload(payload));
  }

  const filtered = allMessages.filter(
    (message) =>
      (message.role === "user" || message.role === "assistant") &&
      message.content.trim().length > 0
  );

  return filtered.length > 0 ? filtered : null;
}

function collectEmbeddedJsonPayloads(
  $: CheerioRoot,
  html: string
): unknown[] {
  const payloads: unknown[] = [];

  // Primary: Next.js hydration blob.
  const nextDataRaw = $("script#__NEXT_DATA__").first().html();
  pushParsedJson(payloads, nextDataRaw);

  // application/json + ld+json script tags.
  $('script[type="application/json"], script[type="application/ld+json"]').each(
    (_, el) => {
      pushParsedJson(payloads, $(el).html());
    }
  );

  // Inline hydration assignments: self.__next_f.push(...), window.__...
  $("script:not([src])").each((_, el) => {
    const source = $(el).html() ?? "";
    if (!source) return;

    // window.__NEXT_DATA__ = {...}
    const nextAssign = source.match(
      /(?:window\.)?__NEXT_DATA__\s*=\s*(\{[\s\S]*\})\s*;?\s*$/m
    );
    pushParsedJson(payloads, nextAssign?.[1]);

    // RSC / next-flight style pushes containing JSON strings
    const pushRegex =
      /__next_f\.push\(\s*\[\s*\d+\s*,\s*"((?:\\.|[^"\\])*)"\s*\]\s*\)/g;
    let pushMatch: RegExpExecArray | null;
    while ((pushMatch = pushRegex.exec(source)) !== null) {
      try {
        const unescaped = JSON.parse(`"${pushMatch[1]}"`) as string;
        if (
          unescaped.includes("mapping") ||
          unescaped.includes("messages") ||
          unescaped.includes("serverResponse")
        ) {
          extractJsonObjectsFromText(unescaped, payloads);
        }
      } catch {
        // ignore malformed flight chunks
      }
    }

    if (
      source.includes("mapping") ||
      source.includes("serverResponse") ||
      source.includes("linear_conversation")
    ) {
      extractJsonObjectsFromText(source, payloads);
    }
  });

  // Last resort: scan raw HTML for a mapping-bearing object.
  if (payloads.length === 0 && /"mapping"\s*:/.test(html)) {
    extractJsonObjectsFromText(html, payloads);
  }

  return payloads;
}

function pushParsedJson(payloads: unknown[], raw: string | null | undefined) {
  if (!raw?.trim()) return;
  try {
    payloads.push(JSON.parse(raw));
  } catch {
    // ignore invalid JSON blocks
  }
}

function extractJsonObjectsFromText(text: string, payloads: unknown[]) {
  const starts: number[] = [];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "{") starts.push(i);
  }

  // Cap work on huge HTML documents.
  const candidates = starts.slice(0, 200);
  for (const start of candidates) {
    const slice = text.slice(start, start + 500_000);
    if (
      !slice.includes('"mapping"') &&
      !slice.includes('"messages"') &&
      !slice.includes('"serverResponse"') &&
      !slice.includes('"linear_conversation"')
    ) {
      continue;
    }

    const objectText = extractBalancedJsonObject(slice);
    if (!objectText) continue;
    try {
      payloads.push(JSON.parse(objectText));
    } catch {
      // continue scanning
    }
  }
}

function extractBalancedJsonObject(source: string): string | null {
  if (!source.startsWith("{")) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(0, i + 1);
      }
    }
  }

  return null;
}

function extractTurnsFromPayload(payload: unknown): ImportedMessage[] {
  if (!payload || typeof payload !== "object") return [];

  const messages: ImportedMessage[] = [];

  // Direct ChatGPT share shapes
  walkForMapping(payload, messages);

  // Linear message arrays
  walkForMessageArrays(payload, messages, 0);

  return messages;
}

function walkForMapping(value: unknown, out: ImportedMessage[], depth = 0) {
  if (depth > 14 || value == null) return;

  if (Array.isArray(value)) {
    for (const item of value) walkForMapping(item, out, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;

  if (record.mapping && typeof record.mapping === "object") {
    out.push(
      ...extractTurnsFromChatGptMapping(
        record.mapping as Record<string, unknown>
      )
    );
  }

  if (
    record.serverResponse &&
    typeof record.serverResponse === "object" &&
    (record.serverResponse as { mapping?: unknown }).mapping
  ) {
    const mapping = (record.serverResponse as { mapping: Record<string, unknown> })
      .mapping;
    out.push(...extractTurnsFromChatGptMapping(mapping));
  }

  // Continue walking common tree nodes only (avoids full O(n) blowup).
  for (const key of [
    "props",
    "pageProps",
    "data",
    "state",
    "serverResponse",
    "continueConversationUrl",
    "sharedConversation",
    "conversation",
    "cit",
  ]) {
    if (key in record) walkForMapping(record[key], out, depth + 1);
  }
}

function walkForMessageArrays(
  value: unknown,
  out: ImportedMessage[],
  depth: number
) {
  if (depth > 12 || value == null) return;

  if (Array.isArray(value)) {
    const looksLikeMessages =
      value.length > 0 &&
      value.every(
        (item) =>
          item &&
          typeof item === "object" &&
          ("role" in item || "author" in item) &&
          ("content" in item || "parts" in item || "text" in item)
      );

    if (looksLikeMessages) {
      for (const item of value) {
        const message = normalizeTurn(item as Record<string, unknown>);
        if (message) out.push(message);
      }
      return;
    }

    for (const item of value) walkForMessageArrays(item, out, depth + 1);
    return;
  }

  if (typeof value !== "object") return;
  const record = value as Record<string, unknown>;

  for (const key of [
    "messages",
    "linear_conversation",
    "chat_messages",
    "chatMessages",
    "items",
    "turns",
  ]) {
    if (key in record) walkForMessageArrays(record[key], out, depth + 1);
  }
}

/**
 * ChatGPT share mapping is a tree of nodes with `message.author.role` and
 * `message.content.parts` (Markdown strings). Ordered by create_time.
 */
function extractTurnsFromChatGptMapping(
  mapping: Record<string, unknown>
): ImportedMessage[] {
  type OrderedTurn = ImportedMessage & { createTime: number; id: string };

  const turns: OrderedTurn[] = [];

  for (const [id, node] of Object.entries(mapping)) {
    if (!node || typeof node !== "object") continue;
    const message = (node as { message?: unknown }).message;
    if (!message || typeof message !== "object") continue;

    const msg = message as Record<string, unknown>;
    const role = roleFromMessage(msg);
    if (!role) continue;

    const content = contentFromMessage(msg);
    if (!content) continue;

    const createTime =
      typeof msg.create_time === "number"
        ? msg.create_time
        : typeof msg.update_time === "number"
          ? msg.update_time
          : Number.MAX_SAFE_INTEGER;

    turns.push({ id, role, content, createTime });
  }

  turns.sort((a, b) => {
    if (a.createTime !== b.createTime) return a.createTime - b.createTime;
    return a.id.localeCompare(b.id);
  });

  return turns.map(({ role, content }) => ({ role, content }));
}

function roleFromMessage(
  message: Record<string, unknown>
): "user" | "assistant" | null {
  const author = message.author;
  if (author && typeof author === "object" && "role" in author) {
    return mapRole(String((author as { role: unknown }).role));
  }
  if (typeof message.role === "string") {
    return mapRole(message.role);
  }
  return null;
}

function mapRole(raw: string): "user" | "assistant" | null {
  const role = raw.toLowerCase();
  if (role === "user" || role === "human" || role === "prompter") return "user";
  if (
    role === "assistant" ||
    role === "tool" ||
    role === "gpt" ||
    role === "model"
  ) {
    // Tool messages sometimes hold final assistant text; keep as assistant.
    return "assistant";
  }
  // Skip system / developer scaffolding.
  return null;
}

/**
 * Build message content from ChatGPT content.parts while preserving
 * Markdown (fenced code, tables, lists) as plain text.
 */
function contentFromMessage(message: Record<string, unknown>): string | null {
  if (typeof message.content === "string") {
    const text = message.content.trim();
    return text || null;
  }

  const content = message.content;
  if (content && typeof content === "object") {
    const record = content as Record<string, unknown>;

    if (Array.isArray(record.parts)) {
      const joined = record.parts
        .map((part) => partToMarkdown(part))
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (joined) return joined;
    }

    if (typeof record.text === "string" && record.text.trim()) {
      return record.text.trim();
    }

    // Multimodal / richer content blocks
    if (Array.isArray(record.content)) {
      const joined = (record.content as unknown[])
        .map((block) => partToMarkdown(block))
        .filter(Boolean)
        .join("\n\n")
        .trim();
      if (joined) return joined;
    }
  }

  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }

  return null;
}

function partToMarkdown(part: unknown): string {
  if (typeof part === "string") {
    return part;
  }

  if (!part || typeof part !== "object") return "";

  const record = part as Record<string, unknown>;

  // Plain text / markdown string parts
  if (typeof record.text === "string") {
    return record.text;
  }
  if (typeof record.value === "string") {
    return record.value;
  }
  if (typeof record.content === "string") {
    return record.content;
  }

  // Code blocks as Markdown fences
  if (
    record.type === "code" ||
    record.content_type === "code" ||
    typeof record.language === "string"
  ) {
    const language =
      typeof record.language === "string" ? record.language : "";
    const code =
      typeof record.code === "string"
        ? record.code
        : typeof record.text === "string"
          ? record.text
          : "";
    if (code) {
      return `\`\`\`${language}\n${code.replace(/\n$/, "")}\n\`\`\``;
    }
  }

  // Nested text arrays
  if (Array.isArray(record.parts)) {
    return record.parts.map((child) => partToMarkdown(child)).join("\n");
  }

  return "";
}

function normalizeTurn(
  record: Record<string, unknown>
): ImportedMessage | null {
  const role = roleFromMessage(record);
  const content = contentFromMessage(record);
  if (!role || !content) return null;
  return { role, content };
}

/**
 * Fallback: parse server-rendered message nodes.
 * Converts HTML structure to Markdown so code/tables survive.
 */
function extractMessagesFromServerRenderedDom(
  $: CheerioRoot
): ImportedMessage[] | null {
  const messages: ImportedMessage[] = [];

  const roleSelectors = [
    "[data-message-author-role]",
    "[data-testid^='conversation-turn']",
    "div[data-message-id]",
  ];

  const roots = new Set<Element>();
  for (const selector of roleSelectors) {
    $(selector).each((_, el) => {
      roots.add(el as Element);
    });
  }

  if (roots.size === 0) {
    // Generic article/message containers
    $("main article, main [class*='message'], main [class*='Message']").each(
      (_, el) => {
        roots.add(el as Element);
      }
    );
  }

  for (const el of Array.from(roots)) {
    const $el = $(el);
    const roleAttr =
      $el.attr("data-message-author-role") ||
      $el.find("[data-message-author-role]").first().attr(
        "data-message-author-role"
      ) ||
      "";

    const role = mapRole(roleAttr);
    if (!role) {
      // Heuristic from headings / labels inside the turn
      const label = $el
        .find("h5, h6, [class*='author'], [class*='Author']")
        .first()
        .text()
        .toLowerCase();
      const inferred =
        label.includes("you") || label.includes("user")
          ? "user"
          : label.includes("chatgpt") || label.includes("assistant")
            ? "assistant"
            : null;
      if (!inferred) continue;

      const markdown = htmlToMarkdown($, el);
      if (markdown) messages.push({ role: inferred, content: markdown });
      continue;
    }

    const markdown = htmlToMarkdown($, el);
    if (markdown) messages.push({ role, content: markdown });
  }

  return messages.length > 0 ? messages : null;
}

/**
 * Convert a message element to Markdown, keeping fences and pipes for tables.
 */
function htmlToMarkdown($: CheerioRoot, root: AnyNode): string {
  const $root = $(root).clone();

  // Prefer the content region when present.
  const $content = $root
    .find(".markdown, .prose, [class*='markdown']")
    .first();
  const scope = $content.length > 0 ? $content : $root;

  // Code blocks → fenced Markdown
  scope.find("pre").each((_, pre) => {
    const $pre = $(pre);
    const $code = $pre.find("code").first();
    const className = $code.attr("class") ?? "";
    const language =
      className.match(/language-([A-Za-z0-9_+-]+)/)?.[1] ??
      className.match(/lang(?:uage)?-([A-Za-z0-9_+-]+)/)?.[1] ??
      "";
    const codeText = ($code.text() || $pre.text()).replace(/\n$/, "");
    $pre.replaceWith(`\n\`\`\`${language}\n${codeText}\n\`\`\`\n`);
  });

  // Inline code
  scope.find("code").each((_, code) => {
    const $code = $(code);
    if ($code.parents("pre").length > 0) return;
    const text = $code.text();
    $code.replaceWith(`\`${text}\``);
  });

  // Tables → GitHub-flavored Markdown tables
  scope.find("table").each((_, table) => {
    const $table = $(table);
    const rows: string[][] = [];

    $table.find("tr").each((__, tr) => {
      const cells: string[] = [];
      $(tr)
        .find("th, td")
        .each((___, cell) => {
          cells.push($(cell).text().trim().replace(/\|/g, "\\|"));
        });
      if (cells.length > 0) rows.push(cells);
    });

    if (rows.length === 0) {
      $table.replaceWith("");
      return;
    }

    const header = rows[0];
    const body = rows.slice(1);
    const lines = [
      `| ${header.join(" | ")} |`,
      `| ${header.map(() => "---").join(" | ")} |`,
      ...body.map((row) => `| ${row.join(" | ")} |`),
    ];
    $table.replaceWith(`\n${lines.join("\n")}\n`);
  });

  // Basic block elements
  scope.find("br").replaceWith("\n");
  scope.find("p, div, li, h1, h2, h3, h4, h5, h6").each((_, el) => {
    const $el = $(el);
    const tag = (el as Element).tagName?.toLowerCase?.() ?? "";
    const text = $el.text();
    if (tag.startsWith("h")) {
      const level = Number(tag[1]) || 1;
      $el.replaceWith(`\n${"#".repeat(level)} ${text.trim()}\n`);
    } else if (tag === "li") {
      $el.replaceWith(`\n- ${text.trim()}`);
    }
  });

  // Anchors: keep Markdown links when href is useful
  scope.find("a[href]").each((_, a) => {
    const $a = $(a);
    const href = $a.attr("href") ?? "";
    const text = $a.text().trim() || href;
    if (href.startsWith("http")) {
      $a.replaceWith(`[${text}](${href})`);
    } else {
      $a.replaceWith(text);
    }
  });

  const text = scope
    .text()
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

function dedupeMessages(messages: ImportedMessage[]): ImportedMessage[] {
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
