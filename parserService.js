import express from "express";
import axios from "axios";

const router = express.Router();

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
};

const httpClient = axios.create({
  headers: BROWSER_HEADERS,
  timeout: 15_000,
  validateStatus: () => true,
});

const PATTERNS = {
  CHATGPT:
    /^https?:\/\/(?:www\.)?(?:chatgpt\.com|chat\.openai\.com)\/share\/([a-zA-Z0-9._-]+)\/?$/i,
  DEEPSEEK:
    /^https?:\/\/(?:www\.)?chat\.deepseek\.com\/share\/([a-zA-Z0-9._-]+)\/?$/i,
  CLAUDE: /^https?:\/\/(www\.)?claude\.ai\/share\/[a-zA-Z0-9._-]+\/?$/i,
};

/**
 * Extract the share ID from a public ChatGPT share URL.
 * e.g. https://chatgpt.com/share/6a76edaf-c9fc-83e8-84ba-6eb44da3b987
 */
function extractChatGptShareId(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (host !== "chatgpt.com" && host !== "www.chatgpt.com" && host !== "chat.openai.com" && host !== "www.chat.openai.com") {
      return null;
    }
    const match = parsed.pathname.match(/^\/share\/([a-zA-Z0-9._-]+)\/?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Extract the share ID from a public DeepSeek share URL.
 * e.g. https://chat.deepseek.com/share/2dvapy6j3qwuw81zkx
 */
function extractDeepSeekShareId(url) {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    if (host !== "chat.deepseek.com" && host !== "www.chat.deepseek.com") {
      return null;
    }
    const match = parsed.pathname.match(/^\/share\/([a-zA-Z0-9._-]+)\/?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function mapRole(raw) {
  const role = String(raw || "").toLowerCase();
  if (role === "user" || role === "human") return "user";
  if (
    role === "assistant" ||
    role === "tool" ||
    role === "gpt" ||
    role === "model"
  ) {
    return "assistant";
  }
  return null;
}

function contentFromMessage(message) {
  if (!message || typeof message !== "object") return null;

  if (typeof message.content === "string") {
    const text = message.content.trim();
    return text || null;
  }

  const content = message.content;
  if (content && typeof content === "object") {
    if (Array.isArray(content.parts)) {
      const joined = content.parts
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && typeof part === "object") {
            if (typeof part.text === "string") return part.text;
            if (typeof part.value === "string") return part.value;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n")
        .trim();
      if (joined) return joined;
    }

    if (typeof content.text === "string" && content.text.trim()) {
      return content.text.trim();
    }
  }

  if (typeof message.text === "string" && message.text.trim()) {
    return message.text.trim();
  }

  return null;
}

function messagesFromLinearConversation(linearConversation) {
  if (!Array.isArray(linearConversation)) return [];

  return linearConversation
    .map((node) => {
      const message = node?.message;
      if (!message) return null;

      const role = mapRole(message.author?.role);
      const content = contentFromMessage(message);
      if (!role || !content) return null;

      return { role, content };
    })
    .filter(Boolean);
}

function messagesFromMapping(mapping) {
  if (!mapping || typeof mapping !== "object") return [];

  const turns = Object.values(mapping)
    .map((node) => {
      const message = node?.message;
      if (!message) return null;

      const role = mapRole(message.author?.role);
      const content = contentFromMessage(message);
      if (!role || !content) return null;

      const createTime =
        typeof message.create_time === "number"
          ? message.create_time
          : Number.MAX_SAFE_INTEGER;

      return { role, content, createTime };
    })
    .filter(Boolean)
    .sort((a, b) => a.createTime - b.createTime);

  return turns.map(({ role, content }) => ({ role, content }));
}

/** AWS WAF / Cloudflare challenge pages (expected HTML is not a block by itself). */
function looksLikeAntiBotChallenge(status, bodyText) {
  if (status === 202 || status === 403 || status === 503 || status === 520) {
    return true;
  }

  const haystack = String(bodyText || "").toLowerCase();
  return (
    haystack.includes("cloudflare") ||
    haystack.includes("cf-ray") ||
    haystack.includes("attention required") ||
    haystack.includes("just a moment") ||
    haystack.includes("access denied") ||
    haystack.includes("awswaf") ||
    haystack.includes("aws-waf") ||
    haystack.includes("awswafcookiedomainlist") ||
    haystack.includes("captcha") ||
    haystack.includes("challenge-platform")
  );
}

/**
 * ChatGPT backend-anon expects JSON. Treat challenge pages and HTML shells as blocked.
 */
function looksLikeCloudflareOrBlock(status, bodyText) {
  if (looksLikeAntiBotChallenge(status, bodyText)) return true;

  const haystack = String(bodyText || "").toLowerCase();
  return (
    haystack.includes("<!doctype html") ||
    haystack.includes("<html")
  );
}

const PASTE_TEXT_FALLBACK_HINT =
  "DeepSeek blocked server-side access to this share link (anti-bot / WAF). Open the link in your browser, copy the conversation, and use the Paste Text tab instead.";

/**
 * Map DeepSeek (and generic chat) role strings to our user/assistant roles.
 */
function mapDeepSeekRole(raw) {
  const role = String(raw || "").toLowerCase().trim();
  if (role === "user" || role === "human" || role === "you" || role === "prompter") {
    return "user";
  }
  if (
    role === "assistant" ||
    role === "model" ||
    role === "ai" ||
    role === "bot" ||
    role === "deepseek" ||
    role === "tool"
  ) {
    return "assistant";
  }
  return null;
}

function textFromDeepSeekField(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const t = value.trim();
    return t || null;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    const joined = value
      .map((part) => textFromDeepSeekField(part))
      .filter(Boolean)
      .join("\n")
      .trim();
    return joined || null;
  }
  if (typeof value === "object") {
    for (const key of [
      "text",
      "content",
      "value",
      "message",
      "answer",
      "response",
      "markdown",
      "parts",
    ]) {
      if (key in value) {
        const nested = textFromDeepSeekField(value[key]);
        if (nested) return nested;
      }
    }
  }
  return null;
}

function deepSeekMessageFromRecord(item) {
  if (!item || typeof item !== "object") return null;

  const role =
    mapDeepSeekRole(item.role) ||
    mapDeepSeekRole(item.author?.role) ||
    mapDeepSeekRole(item.sender) ||
    mapDeepSeekRole(item.type) ||
    mapDeepSeekRole(item.message_type) ||
    mapDeepSeekRole(item.from);

  const reasoning =
    textFromDeepSeekField(item.reasoning) ||
    textFromDeepSeekField(item.reasoning_content) ||
    textFromDeepSeekField(item.thinking) ||
    textFromDeepSeekField(item.thought) ||
    textFromDeepSeekField(item.thought_process);

  let content =
    textFromDeepSeekField(item.content) ||
    textFromDeepSeekField(item.message) ||
    textFromDeepSeekField(item.text) ||
    textFromDeepSeekField(item.fragments) ||
    textFromDeepSeekField(item.parts);

  // Some DeepSeek payloads nest answer under content.segments / content.content
  if (!content && item.content && typeof item.content === "object") {
    content =
      textFromDeepSeekField(item.content.content) ||
      textFromDeepSeekField(item.content.text);
  }

  if (!role) return null;
  if (!content && !reasoning) return null;

  if (role === "assistant" && reasoning) {
    if (content) {
      return {
        role,
        content: `Thinking:\n${reasoning}\n\n${content}`,
        reasoning,
      };
    }
    return { role, content: reasoning, reasoning };
  }

  if (!content) return null;
  return { role, content };
}

/**
 * Recursively find arrays that look like chat message lists.
 */
function collectMessageCandidateArrays(node, out = [], depth = 0) {
  if (depth > 10 || node == null) return out;

  if (Array.isArray(node)) {
    if (node.length > 0) {
      const sample = node.slice(0, 8);
      const score = sample.filter(
        (item) =>
          item &&
          typeof item === "object" &&
          (Object.prototype.hasOwnProperty.call(item, "role") ||
            Object.prototype.hasOwnProperty.call(item, "content") ||
            Object.prototype.hasOwnProperty.call(item, "message") ||
            Object.prototype.hasOwnProperty.call(item, "author") ||
            Object.prototype.hasOwnProperty.call(item, "parts"))
      ).length;
      if (score >= Math.min(2, sample.length) || (sample.length === 1 && score === 1)) {
        out.push(node);
      }
    }
    for (const item of node) collectMessageCandidateArrays(item, out, depth + 1);
    return out;
  }

  if (typeof node === "object") {
    for (const value of Object.values(node)) {
      collectMessageCandidateArrays(value, out, depth + 1);
    }
  }
  return out;
}

function extractMessagesFromDeepSeekData(data) {
  if (!data || typeof data !== "object") return [];

  const preferredPaths = [
    data.messages,
    data.chat_messages,
    data.conversation,
    data.history,
    data.linear_conversation,
    data.mapping,
    data.biz_data?.messages,
    data.biz_data?.chat_messages,
    data.biz_data?.chat_session?.messages,
    data.biz_data?.history_messages,
    data.data?.messages,
    data.data?.biz_data?.messages,
    data.data?.biz_data?.chat_messages,
    data.data?.biz_data?.history_messages,
    data.serverResponse?.data?.messages,
    data.server_response?.data?.messages,
  ];

  for (const candidate of preferredPaths) {
    if (!candidate) continue;
    if (Array.isArray(candidate)) {
      const msgs = candidate.map(deepSeekMessageFromRecord).filter(Boolean);
      if (msgs.length) return msgs;
      // ChatGPT-style nodes
      const linear = messagesFromLinearConversation(candidate);
      if (linear.length) return linear;
    }
    if (typeof candidate === "object" && !Array.isArray(candidate)) {
      const fromMap = messagesFromMapping(candidate);
      if (fromMap.length) return fromMap;
    }
  }

  // Heuristic deep search for message-like arrays
  const arrays = collectMessageCandidateArrays(data);
  let best = [];
  for (const arr of arrays) {
    const msgs = arr.map(deepSeekMessageFromRecord).filter(Boolean);
    if (msgs.length > best.length) best = msgs;
  }
  return best;
}

function extractTitleFromDeepSeekData(data) {
  if (!data || typeof data !== "object") return null;
  const candidates = [
    data.title,
    data.name,
    data.subject,
    data.chat_title,
    data.conversation_title,
    data.biz_data?.title,
    data.biz_data?.name,
    data.biz_data?.chat_session?.title,
    data.data?.title,
    data.data?.biz_data?.title,
    data.data?.biz_data?.chat_session?.title,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return null;
}

function tryParseJsonLoose(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      // continue
    }
  }
  // allorigins get envelope
  try {
    const envelope = JSON.parse(raw);
    if (envelope && typeof envelope.contents === "string") {
      try {
        return JSON.parse(envelope.contents);
      } catch {
        return envelope.contents;
      }
    }
  } catch {
    // not envelope
  }
  return null;
}

/**
 * Extract embedded JSON payload candidates from a DeepSeek HTML shell.
 */
function extractEmbeddedJsonBlobs(html) {
  const blobs = [];
  const text = String(html || "");

  // <script type="application/json">…</script>
  for (const match of text.matchAll(
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    if (match[1]?.trim()) blobs.push(match[1].trim());
  }

  // __NEXT_DATA__
  for (const match of text.matchAll(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    if (match[1]?.trim()) blobs.push(match[1].trim());
  }

  // window.__* = {…}
  for (const match of text.matchAll(
    /window\.__[A-Z0-9_]+__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/gi
  )) {
    if (match[1]?.trim()) blobs.push(match[1].trim());
  }

  // Large inline JSON chunks containing role/content
  for (const match of text.matchAll(
    /(\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*"role"\s*:\s*"(?:user|assistant)"(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\})/gi
  )) {
    if (match[1]?.length > 40 && match[1].length < 5_000_000) {
      blobs.push(match[1]);
    }
  }

  return blobs;
}

function extractTitleFromHtml(html) {
  const text = String(html || "");
  const og = text.match(
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
  );
  if (og?.[1]?.trim()) return og[1].trim();
  const title = text.match(/<title[^>]*>([^<]*)<\/title>/i);
  if (title?.[1]?.trim() && !/^deepseek$/i.test(title[1].trim())) {
    return title[1].trim();
  }
  return null;
}

/**
 * Try to turn HTML/text body into DeepSeek thread messages.
 */
function parseDeepSeekPageBody(bodyText, status) {
  if (looksLikeAntiBotChallenge(status, bodyText)) {
    return null;
  }

  const asJson = tryParseJsonLoose(bodyText);
  if (asJson && typeof asJson === "object") {
    const messages = extractMessagesFromDeepSeekData(asJson);
    if (messages.length) {
      return {
        title: extractTitleFromDeepSeekData(asJson),
        messages,
      };
    }
  }

  // Embedded JSON in HTML
  const blobs = extractEmbeddedJsonBlobs(bodyText);
  for (const blob of blobs) {
    const parsed = tryParseJsonLoose(blob);
    if (!parsed || typeof parsed !== "object") continue;
    const messages = extractMessagesFromDeepSeekData(parsed);
    if (messages.length) {
      return {
        title:
          extractTitleFromDeepSeekData(parsed) || extractTitleFromHtml(bodyText),
        messages,
      };
    }
  }

  // Last-ditch: strip tags and run speaker-label paste parser
  const stripped = String(bodyText)
    .replace(/<script[\s\S]*?<\/script>/gi, "\n")
    .replace(/<style[\s\S]*?<\/style>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (stripped.length > 40) {
    // parseRawText is defined later; call via function that is hoisted after redefine.
    // We reference it only from async parseDeepSeekShareLink after module load.
  }

  return {
    title: extractTitleFromHtml(bodyText),
    messages: [],
    plainText: stripped,
  };
}

/**
 * GET DeepSeek share HTML/JSON with direct request then public proxy fallbacks.
 */
async function fetchDeepSeekShareBodies(shareId, originalUrl) {
  const pageUrl = `https://chat.deepseek.com/share/${shareId}`;
  const apiCandidates = [
    `https://chat.deepseek.com/api/v0/chat_session/share/${shareId}`,
    `https://chat.deepseek.com/api/v0/chat_session/share?share_id=${encodeURIComponent(shareId)}`,
    `https://chat.deepseek.com/api/v0/chat_session/share?share_code=${encodeURIComponent(shareId)}`,
    `https://chat.deepseek.com/api/v0/chat_session/fetch_share?share_id=${encodeURIComponent(shareId)}`,
    `https://chat.deepseek.com/api/v0/share/${shareId}`,
    `https://chat.deepseek.com/api/v0/share/detail?share_code=${encodeURIComponent(shareId)}`,
    pageUrl,
  ];

  const directHeaders = {
    ...BROWSER_HEADERS,
    Accept: "application/json, text/html, text/plain, */*",
    Referer: originalUrl || pageUrl,
    Origin: "https://chat.deepseek.com",
  };

  const bodies = [];
  let sawBlock = false;

  for (const url of apiCandidates) {
    try {
      const res = await httpClient.get(url, {
        headers: directHeaders,
        responseType: "text",
        transformResponse: [(body) => body],
      });
      const text =
        typeof res.data === "string"
          ? res.data
          : JSON.stringify(res.data ?? "");

      if (looksLikeAntiBotChallenge(res.status, text)) {
        sawBlock = true;
        console.warn(
          `[parserService] DeepSeek direct fetch blocked for ${url} (HTTP ${res.status})`
        );
        continue;
      }

      if (res.status >= 200 && res.status < 300 && text.trim()) {
        bodies.push({ url, status: res.status, text, via: "direct" });
      } else if (res.status === 404 || res.status === 410) {
        throw new Error(
          "This DeepSeek share link was not found. It may have been deleted or expired."
        );
      } else if (res.status === 401) {
        throw new Error(
          "This DeepSeek share link is private or restricted. Only public share links can be imported."
        );
      }
    } catch (error) {
      if (
        error?.message?.includes("not found") ||
        error?.message?.includes("private")
      ) {
        throw error;
      }
      console.warn(
        "[parserService] DeepSeek direct fetch error:",
        url,
        error?.message || error
      );
      sawBlock = true;
    }
  }

  // Proxy fallbacks for the public share page + main API candidates
  const proxyTargets = [
    pageUrl,
    `https://chat.deepseek.com/api/v0/chat_session/share?share_code=${encodeURIComponent(shareId)}`,
    `https://chat.deepseek.com/api/v0/chat_session/fetch_share?share_id=${encodeURIComponent(shareId)}`,
  ];
  const proxyWrappers = (target) => [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(target)}`,
    `https://api.allorigins.win/get?url=${encodeURIComponent(target)}`,
  ];

  for (const target of proxyTargets) {
    for (const proxyUrl of proxyWrappers(target)) {
      try {
        const proxied = await httpClient.get(proxyUrl, {
          headers: {
            "User-Agent": BROWSER_HEADERS["User-Agent"],
            Accept: "application/json, text/plain, */*",
          },
          responseType: "text",
          transformResponse: [(body) => body],
        });
        let text =
          typeof proxied.data === "string"
            ? proxied.data
            : JSON.stringify(proxied.data ?? "");

        // allorigins /get wraps contents
        try {
          const env = JSON.parse(text);
          if (env && typeof env.contents === "string") {
            text = env.contents;
          }
        } catch {
          // raw body
        }

        if (proxied.status < 200 || proxied.status >= 300) {
          continue;
        }
        if (looksLikeAntiBotChallenge(proxied.status, text)) {
          sawBlock = true;
          continue;
        }
        if (text.trim()) {
          bodies.push({
            url: proxyUrl,
            status: proxied.status,
            text,
            via: "proxy",
          });
        }
      } catch (error) {
        console.warn(
          "[parserService] DeepSeek proxy fetch failed:",
          proxyUrl,
          error?.message || error
        );
        sawBlock = true;
      }
    }
  }

  return { bodies, sawBlock };
}

/**
 * Fetch a public DeepSeek share page / API and normalize to thread data.
 * Falls back to proxies; surfaces a Paste Text hint when blocked.
 */
async function parseDeepSeekShareLink(url) {
  const shareId = extractDeepSeekShareId(url);

  if (!shareId) {
    throw new Error(
      "Invalid DeepSeek share URL. Could not extract a share ID. Expected format: https://chat.deepseek.com/share/{id}"
    );
  }

  const cleanUrl = url.trim();

  try {
    const { bodies, sawBlock } = await fetchDeepSeekShareBodies(
      shareId,
      cleanUrl
    );

    let best = null;

    for (const body of bodies) {
      const parsed = parseDeepSeekPageBody(body.text, body.status);
      if (!parsed) continue;

      let messages = parsed.messages || [];
      if (messages.length === 0 && parsed.plainText) {
        const fromText = parseRawText(parsed.plainText);
        if (fromText.messages?.length) {
          messages = fromText.messages;
        }
      }

      if (messages.length === 0) continue;

      best = {
        source: "DeepSeek",
        verified: body.via === "direct",
        originalUrl: cleanUrl,
        title:
          (parsed.title && String(parsed.title).trim()) ||
          "Imported DeepSeek Thread",
        messages,
      };
      break;
    }

    if (best) return best;

    if (sawBlock || bodies.length === 0) {
      throw new Error(PASTE_TEXT_FALLBACK_HINT);
    }

    throw new Error(
      "DeepSeek share link loaded, but no conversation messages were found. Try the Paste Text tab with a copy of the chat."
    );
  } catch (error) {
    console.error("DeepSeek Parser Error:", error?.message || error);
    if (
      error?.message?.includes("Paste Text") ||
      error?.message?.includes("not found") ||
      error?.message?.includes("private") ||
      error?.message?.includes("Invalid DeepSeek")
    ) {
      throw error;
    }
    throw new Error(
      error?.message
        ? `${error.message} If this persists, use the Paste Text tab.`
        : PASTE_TEXT_FALLBACK_HINT
    );
  }
}

function parseShareJsonBody(data) {
  if (data == null) {
    throw new Error("Empty response body from ChatGPT share API.");
  }

  // Proxy wrappers sometimes return a JSON string.
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      throw new Error(
        "ChatGPT share API returned non-JSON content (possible Cloudflare block)."
      );
    }
  }

  if (typeof data !== "object") {
    throw new Error("ChatGPT share API returned an unexpected payload type.");
  }

  return data;
}

function extractMessagesFromShareData(data) {
  let messages = messagesFromLinearConversation(data.linear_conversation);

  if (messages.length === 0 && data.mapping) {
    messages = messagesFromMapping(data.mapping);
  }

  if (messages.length === 0) {
    const nested =
      data.data ||
      data.serverResponse?.data ||
      data.server_response?.data;
    if (nested && typeof nested === "object") {
      messages = messagesFromLinearConversation(nested.linear_conversation);
      if (messages.length === 0 && nested.mapping) {
        messages = messagesFromMapping(nested.mapping);
      }
      if (
        (!data.title || !String(data.title).trim()) &&
        typeof nested.title === "string"
      ) {
        data.title = nested.title;
      }
    }
  }

  return messages;
}

/**
 * GET ChatGPT backend-anon share JSON, with public CORS/unblock proxy fallback
 * when the direct request is Cloudflare/403 blocked.
 */
async function fetchChatGptSharePayload(shareId, originalUrl) {
  const primaryUrl = `https://chatgpt.com/backend-anon/share/${shareId}`;
  const proxyUrls = [
    `https://api.allorigins.win/raw?url=${encodeURIComponent(primaryUrl)}`,
    `https://corsproxy.io/?${encodeURIComponent(primaryUrl)}`,
  ];

  // 1) Direct server-side request to ChatGPT
  try {
    const direct = await httpClient.get(primaryUrl, {
      headers: {
        ...BROWSER_HEADERS,
        Referer: originalUrl,
        Origin: "https://chatgpt.com",
      },
      responseType: "text",
      transformResponse: [(body) => body],
    });

    const bodyText =
      typeof direct.data === "string"
        ? direct.data
        : JSON.stringify(direct.data ?? "");

    if (
      direct.status >= 200 &&
      direct.status < 300 &&
      !looksLikeCloudflareOrBlock(direct.status, bodyText)
    ) {
      return parseShareJsonBody(bodyText);
    }

    const shouldFallback =
      looksLikeCloudflareOrBlock(direct.status, bodyText) ||
      direct.status === 403 ||
      direct.status === 429 ||
      direct.status === 503;

    if (!shouldFallback) {
      if (direct.status === 404 || direct.status === 410) {
        throw new Error(
          "This ChatGPT share link was not found. It may have been deleted or expired."
        );
      }
      if (direct.status === 401) {
        throw new Error(
          "This ChatGPT share link is private or restricted. Only public share links can be imported."
        );
      }
      throw new Error(
        `ChatGPT share API returned HTTP ${direct.status}. The link may be private, expired, or deleted.`
      );
    }

    console.warn(
      `[parserService] Direct ChatGPT fetch blocked (HTTP ${direct.status}); trying CORS proxy fallback…`
    );
  } catch (error) {
    // Network failures also try proxy fallback.
    if (
      error?.message?.includes("not found") ||
      error?.message?.includes("private") ||
      error?.message?.includes("returned HTTP")
    ) {
      throw error;
    }
    console.warn(
      "[parserService] Direct ChatGPT fetch failed:",
      error?.message || error
    );
  }

  // 2) Public CORS/unblock proxy wrappers
  let lastError = null;

  for (const proxyUrl of proxyUrls) {
    try {
      const proxied = await httpClient.get(proxyUrl, {
        headers: {
          "User-Agent": BROWSER_HEADERS["User-Agent"],
          Accept: "application/json, text/plain, */*",
        },
        responseType: "text",
        transformResponse: [(body) => body],
      });

      const bodyText =
        typeof proxied.data === "string"
          ? proxied.data
          : JSON.stringify(proxied.data ?? "");

      if (proxied.status < 200 || proxied.status >= 300) {
        lastError = new Error(
          `Proxy returned HTTP ${proxied.status} for ChatGPT share API.`
        );
        continue;
      }

      if (looksLikeCloudflareOrBlock(proxied.status, bodyText)) {
        lastError = new Error(
          "Proxy still received a Cloudflare/block page from ChatGPT."
        );
        continue;
      }

      return parseShareJsonBody(bodyText);
    } catch (error) {
      lastError = error;
      console.warn(
        "[parserService] Proxy fetch failed:",
        proxyUrl,
        error?.message || error
      );
    }
  }

  throw new Error(
    lastError?.message ||
      "Failed to fetch ChatGPT share data. Direct request and CORS proxy fallbacks all failed. The link may be private, expired, deleted, or blocked."
  );
}

/**
 * Fetch ChatGPT share data from backend-anon JSON API (with proxy fallback).
 */
async function parseChatGPTShareLink(url) {
  const shareId = extractChatGptShareId(url);

  if (!shareId) {
    throw new Error(
      "Invalid ChatGPT share URL. Could not extract a share ID. Expected format: https://chatgpt.com/share/{id}"
    );
  }

  try {
    const data = await fetchChatGptSharePayload(shareId, url);

    const title =
      (typeof data.title === "string" && data.title.trim()) ||
      "Untitled ChatGPT Thread";

    const messages = extractMessagesFromShareData(data);

    if (messages.length === 0) {
      throw new Error(
        "ChatGPT share API responded successfully, but no conversation turns were found in linear_conversation or mapping."
      );
    }

    return {
      source: "ChatGPT",
      verified: true,
      originalUrl: url,
      title,
      messages,
    };
  } catch (error) {
    console.error("ChatGPT Parser Error:", error?.message || error);
    throw new Error(
      error?.message ||
        "Failed to parse ChatGPT share link. The link may be private, expired, deleted, or blocked by Cloudflare."
    );
  }
}

async function parseClaudeShareLink(url) {
  return {
    source: "Claude",
    verified: true,
    originalUrl: url,
    title: "Imported Claude Thread",
    messages: [
      { role: "user", content: "Sample Claude prompt" },
      { role: "assistant", content: "Sample Claude response" },
    ],
  };
}

/**
 * Speaker labels recognized at line start (case-insensitive).
 * Includes ChatGPT, Claude, Gemini, Assistant, and DeepSeek pastes.
 */
const SPEAKER_LABEL =
  "(?:User|You|Human|DeepSeek|ChatGPT|Claude|Gemini|Assistant|Thought\\s+process|Thinking|Thought\\s+for\\b[^\\n:]*)";

const SPEAKER_SPLIT = new RegExp(`(?=^${SPEAKER_LABEL}\\s*:)`, "gim");
const SPEAKER_LINE = new RegExp(`^${SPEAKER_LABEL}\\s*:\\s*([\\s\\S]*)$`, "i");
const SPEAKER_LABEL_ONLY = new RegExp(`^(${SPEAKER_LABEL})\\s*:`, "i");

function normalizeSpeakerLabel(label) {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isUserLabel(label) {
  const n = normalizeSpeakerLabel(label);
  return n === "user" || n === "you" || n === "human";
}

/** DeepSeek (and ChatGPT "Thought for…") reasoning / chain-of-thought headers. */
function isReasoningLabel(label) {
  const n = normalizeSpeakerLabel(label);
  return (
    n === "thought process" ||
    n === "thinking" ||
    /^thought for\b/.test(n)
  );
}

/**
 * Detect DeepSeek conversation pastes from speaker markers or body text.
 * Prefer explicit DeepSeek: / Thought process: — plain "Thinking:" alone is ambiguous.
 */
function hasDeepSeekIndicators(raw) {
  return (
    /\bDeepSeek\s*:/i.test(raw) ||
    /\bThought\s+process\s*:/i.test(raw)
  );
}

/**
 * Detect Claude conversation pastes from speaker markers.
 */
function hasClaudeIndicators(raw) {
  return /\bClaude\s*:/i.test(raw);
}

/**
 * Detect Google Gemini conversation pastes from speaker markers.
 */
function hasGeminiIndicators(raw) {
  return /\bGemini\s*:/i.test(raw);
}

/**
 * Pull inline Thought process / Thinking blocks out of an assistant reply body.
 * Returns { content, reasoning? }.
 */
function extractInlineReasoning(body) {
  const text = String(body || "").trim();
  if (!text) return { content: "" };

  // Leading "Thought process:" / "Thinking:" block, then the rest is the answer.
  const leading = text.match(
    /^(?:Thought\s+process|Thinking)\s*:\s*([\s\S]+?)(?:\n{2,}|(?=\n(?:Response|Answer|Final\s+answer)\s*:))([\s\S]*)$/i
  );
  if (leading) {
    const reasoning = leading[1].trim();
    let content = leading[2]
      .trim()
      .replace(/^(?:Response|Answer|Final\s+answer)\s*:\s*/i, "");
    if (reasoning && content) {
      return { content, reasoning };
    }
    if (reasoning && !content) {
      return { content: reasoning, reasoning };
    }
  }

  // "Thought process: … \n DeepSeek: …" if both got pasted inside one chunk
  const nested = text.match(
    /^(?:Thought\s+process|Thinking)\s*:\s*([\s\S]+?)\n+(?:DeepSeek|Assistant|Response)\s*:\s*([\s\S]+)$/i
  );
  if (nested) {
    return {
      reasoning: nested[1].trim(),
      content: nested[2].trim(),
    };
  }

  return { content: text };
}

/**
 * Attach reasoning to an assistant message: optional `reasoning` field plus a
 * clean Thinking header above main content for UIs that only render `content`.
 */
function buildAssistantMessage(content, reasoning) {
  const extracted = extractInlineReasoning(content);
  const main = extracted.content;
  const reasonParts = [reasoning, extracted.reasoning].filter(
    (part) => typeof part === "string" && part.trim()
  );
  const mergedReasoning = reasonParts.length
    ? reasonParts.join("\n\n").trim()
    : undefined;

  if (!main && !mergedReasoning) {
    return null;
  }

  if (!main && mergedReasoning) {
    return {
      role: "assistant",
      content: mergedReasoning,
      reasoning: mergedReasoning,
    };
  }

  if (mergedReasoning) {
    return {
      role: "assistant",
      content: `Thinking:\n${mergedReasoning}\n\n${main}`,
      reasoning: mergedReasoning,
    };
  }

  return {
    role: "assistant",
    content: main,
  };
}

/** Strip a previously injected Thinking header so we can re-merge cleanly. */
function stripThinkingPrefix(content, knownReasoning) {
  const text = String(content || "");
  if (knownReasoning) {
    const prefix = `Thinking:\n${knownReasoning}\n\n`;
    if (text.startsWith(prefix)) {
      return text.slice(prefix.length);
    }
  }
  return text.replace(/^Thinking:\n[\s\S]*?\n\n/, "");
}

/**
 * Parse raw pasted chat text into structured message turns (+ source metadata).
 *
 * Recognized speaker labels (case-insensitive, typically at line start):
 * - User / You → role: "user"
 * - DeepSeek / ChatGPT / Claude / Gemini / Assistant → role: "assistant"
 * - Thought process / Thinking / Thought for… → reasoning (merged into next assistant turn)
 *
 * @returns {{ source: string, title: string, messages: Array<{ role: 'user'|'assistant', content: string, reasoning?: string }> }}
 */
function parseRawText(text) {
  if (typeof text !== "string") {
    return { source: "Pasted Text", title: "Imported Thread", messages: [] };
  }

  const raw = text.replace(/^\uFEFF/, "").trim();
  if (!raw) {
    return { source: "Pasted Text", title: "Imported Thread", messages: [] };
  }

  const deepSeek = hasDeepSeekIndicators(raw);
  const claude = hasClaudeIndicators(raw);
  const gemini = hasGeminiIndicators(raw);
  let sawChatGpt = false;
  let sawClaude = false;
  let sawDeepSeek = false;
  let sawGemini = false;

  const chunks = raw.split(SPEAKER_SPLIT);
  /** @type {Array<{ role: 'user'|'assistant', content: string, reasoning?: string }>} */
  const messages = [];
  /** @type {string[]} */
  let pendingReasoning = [];

  function flushReasoningOntoLastAssistant() {
    if (pendingReasoning.length === 0) return;
    const reasoning = pendingReasoning.join("\n\n").trim();
    pendingReasoning = [];
    if (!reasoning) return;

    if (messages.length > 0 && messages[messages.length - 1].role === "assistant") {
      const last = messages[messages.length - 1];
      const combinedReasoning = [last.reasoning, reasoning]
        .filter(Boolean)
        .join("\n\n");
      const baseContent = stripThinkingPrefix(last.content, last.reasoning);
      const rebuilt = buildAssistantMessage(baseContent, combinedReasoning);
      if (rebuilt) messages[messages.length - 1] = rebuilt;
      return;
    }

    const orphan = buildAssistantMessage("", reasoning);
    if (orphan) messages.push(orphan);
  }

  /**
   * Collapse consecutive assistant turns into one message so multi-paragraph
   * replies (or multiple Claude:/Assistant: blocks without a User:/Human:
   * in between) render as a single AI card.
   */
  function appendAssistantMessage(content, reasoning) {
    const msg = buildAssistantMessage(content, reasoning);
    if (!msg) return;

    const last = messages.length > 0 ? messages[messages.length - 1] : null;
    if (last && last.role === "assistant") {
      const lastBody = stripThinkingPrefix(last.content, last.reasoning);
      const nextBody = stripThinkingPrefix(msg.content, msg.reasoning);
      const combinedReasoning = [last.reasoning, msg.reasoning]
        .filter(Boolean)
        .join("\n\n");
      const combinedContent = [lastBody, nextBody]
        .filter((part) => typeof part === "string" && part.trim())
        .join("\n\n");
      const rebuilt = buildAssistantMessage(
        combinedContent,
        combinedReasoning || undefined
      );
      if (rebuilt) {
        messages[messages.length - 1] = rebuilt;
        return;
      }
    }

    messages.push(msg);
  }

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const labelMatch = trimmed.match(SPEAKER_LABEL_ONLY);
    if (!labelMatch) {
      // Continue hanging text onto the previous message when present.
      if (messages.length > 0) {
        const last = messages[messages.length - 1];
        // Prefer merging unlabeled multi-paragraph blocks into the open turn.
        last.content = `${last.content}\n\n${trimmed}`.replace(/\n{3,}/g, "\n\n");
      } else if (pendingReasoning.length > 0) {
        pendingReasoning[pendingReasoning.length - 1] += `\n${trimmed}`;
      }
      continue;
    }

    const label = labelMatch[1];
    const bodyMatch = trimmed.match(SPEAKER_LINE);
    const body = bodyMatch ? bodyMatch[1].trim() : "";

    const labelNorm = normalizeSpeakerLabel(label);
    if (labelNorm === "chatgpt") sawChatGpt = true;
    if (labelNorm === "claude") sawClaude = true;
    if (labelNorm === "deepseek") sawDeepSeek = true;
    if (labelNorm === "gemini") sawGemini = true;

    if (isReasoningLabel(label)) {
      if (body) pendingReasoning.push(body);
      continue;
    }

    if (isUserLabel(label)) {
      // User turns don't take pending thought blocks; attach them to prior assistant if any.
      flushReasoningOntoLastAssistant();
      if (!body) continue;
      messages.push({ role: "user", content: body });
      continue;
    }

    // Assistant-class: DeepSeek, ChatGPT, Claude, Assistant, etc.
    // Merge consecutive assistant blocks when no User:/Human: is between them.
    const reasoning =
      pendingReasoning.length > 0
        ? pendingReasoning.join("\n\n").trim()
        : undefined;
    pendingReasoning = [];

    appendAssistantMessage(body, reasoning);
  }

  flushReasoningOntoLastAssistant();

  // Final pass: merge any remaining adjacent assistant cards (defensive).
  const compacted = [];
  for (const message of messages) {
    const prev = compacted[compacted.length - 1];
    if (prev && prev.role === "assistant" && message.role === "assistant") {
      const prevBody = stripThinkingPrefix(prev.content, prev.reasoning);
      const nextBody = stripThinkingPrefix(message.content, message.reasoning);
      const combinedReasoning = [prev.reasoning, message.reasoning]
        .filter(Boolean)
        .join("\n\n");
      const rebuilt = buildAssistantMessage(
        [prevBody, nextBody].filter(Boolean).join("\n\n"),
        combinedReasoning || undefined
      );
      if (rebuilt) {
        compacted[compacted.length - 1] = rebuilt;
        continue;
      }
    }
    compacted.push(message);
  }
  messages.length = 0;
  messages.push(...compacted);

  let source = "Pasted Text";
  let title = "Imported Thread";

  if (deepSeek || sawDeepSeek) {
    source = "DeepSeek";
    title = "Imported DeepSeek Thread";
  } else if (claude || sawClaude) {
    source = "Claude";
    title = "Imported Claude Thread";
  } else if (gemini || sawGemini) {
    source = "Gemini";
    title = "Imported Gemini Thread";
  } else if (sawChatGpt) {
    source = "ChatGPT";
    title = "Imported Thread";
  }

  return { source, title, messages };
}

router.post("/api/import-link", async (req, res) => {
  const { url } = req.body;

  if (!url || typeof url !== "string") {
    return res.status(400).json({
      success: false,
      error: "A valid URL string is required.",
    });
  }

  const cleanUrl = url.trim();

  try {
    let result = null;

    if (PATTERNS.CHATGPT.test(cleanUrl)) {
      result = await parseChatGPTShareLink(cleanUrl);
    } else if (PATTERNS.DEEPSEEK.test(cleanUrl)) {
      result = await parseDeepSeekShareLink(cleanUrl);
    } else if (PATTERNS.CLAUDE.test(cleanUrl)) {
      result = await parseClaudeShareLink(cleanUrl);
    } else {
      return res.status(400).json({
        success: false,
        error:
          "Unsupported or invalid URL. Please provide an official ChatGPT or DeepSeek share link.",
      });
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err) {
    return res.status(422).json({
      success: false,
      error:
        err.message ||
        "An unexpected error occurred while importing the link.",
    });
  }
});

/**
 * POST /api/parse-text
 * Body: { text: string }
 * Parses pasted chat transcripts into structured message turns.
 */
router.post("/api/parse-text", async (req, res) => {
  const { text } = req.body ?? {};

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({
      success: false,
      error: "A non-empty text string is required.",
    });
  }

  try {
    const parsed = parseRawText(text);
    const messages = parsed.messages ?? [];

    if (messages.length === 0) {
      return res.status(422).json({
        success: false,
        error:
          'Could not detect speaker turns. Use labels like "User:" / "You:" and "DeepSeek:" / "ChatGPT:" / "Assistant:" / "Thought process:" / "Thinking:".',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        source: parsed.source || "Pasted Text",
        title: parsed.title || "Imported Thread",
        messages,
      },
    });
  } catch (err) {
    return res.status(422).json({
      success: false,
      error:
        err.message ||
        "An unexpected error occurred while parsing the text.",
    });
  }
});

export default router;
export { parseChatGPTShareLink, parseDeepSeekShareLink, parseRawText };
