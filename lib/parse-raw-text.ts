/**
 * Client-safe paste transcript parser (mirrors parserService.parseRawText).
 * Strips date/time headers that copy/pastes often include at the top of chats.
 */

export type ParsedRawMessage = {
  role: "user" | "assistant";
  content: string;
  reasoning?: string;
};

export type ParseRawTextResult = {
  source: string;
  title: string;
  messages: ParsedRawMessage[];
};

const SPEAKER_LABEL =
  "(?:User|You|Human|DeepSeek|ChatGPT|Claude|Gemini|Assistant|AI|Thought\\s+process|Thinking|Thought\\s+for\\b[^\\n:]*)";

const SPEAKER_SPLIT = new RegExp(`(?=^${SPEAKER_LABEL}\\s*:)`, "gim");
const SPEAKER_LINE = new RegExp(`^${SPEAKER_LABEL}\\s*:\\s*([\\s\\S]*)$`, "i");
const SPEAKER_LABEL_ONLY = new RegExp(`^(${SPEAKER_LABEL})\\s*:`, "i");

/** Weekday + month date/time stamps, e.g. "Tue, Nov 4 at 1:14 PM". */
const DATETIME_LINE_RES: RegExp[] = [
  // Tue, Nov 4 at 1:14 PM | Tuesday, November 4, 2025 at 1:14:02 PM
  /^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s*,?\s+[A-Za-z]+\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?(?:\s+at\s+|\s+[,·|]\s*|\s+)\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\.?$/i,
  // Nov 4, 2025 1:14 PM | November 4 at 1:14 PM
  /^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?(?:\s+at\s+|\s+)\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\.?$/i,
  // 11/4/2025 1:14 PM | 2025-11-04 13:14
  /^(?:\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})(?:\s+[T,]?\s*\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?)?\.?$/i,
  // Today at 1:14 PM | Yesterday 13:14
  /^(?:Today|Yesterday)\s+(?:at\s+)?\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)?\.?$/i,
  // Standalone time line: 1:14 PM
  /^\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM|am|pm)\.?$/i,
];

function normalizeSpeakerLabel(label: string): string {
  return String(label || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function isUserLabel(label: string): boolean {
  const n = normalizeSpeakerLabel(label);
  return n === "user" || n === "you" || n === "human";
}

function isReasoningLabel(label: string): boolean {
  const n = normalizeSpeakerLabel(label);
  return (
    n === "thought process" ||
    n === "thinking" ||
    /^thought for\b/.test(n)
  );
}

/** Markdown image line or line containing `![alt](url)` — never strip these. */
function containsMarkdownImage(line: string): boolean {
  return /!\[[^\]]*\]\([^)\s]+[^)]*\)/.test(String(line || ""));
}

/** True when a turn has plain text and/or image Markdown (not empty whitespace). */
function hasTurnContent(text: string): boolean {
  const t = String(text || "").trim();
  if (!t) return false;
  return containsMarkdownImage(t) || t.length > 0;
}

function isDateTimeHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 80) return false;
  // Preserve markdown images (ChatGPT estuary / DALL·E tags from the bookmarklet).
  if (containsMarkdownImage(trimmed) || trimmed.startsWith("![")) return false;
  // Never treat a speaker line as a date header.
  if (SPEAKER_LABEL_ONLY.test(trimmed)) return false;
  return DATETIME_LINE_RES.some((re) => re.test(trimmed));
}

/**
 * Remove standalone date/time header lines (start of paste or between turns)
 * so they never form false messages or glue onto speaker detection.
 * Leaves Markdown image tags intact for Conversation Preview rendering.
 */
export function stripDateTimeHeaders(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => !isDateTimeHeaderLine(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function hasDeepSeekIndicators(raw: string): boolean {
  return (
    /\bDeepSeek\s*:/i.test(raw) || /\bThought\s+process\s*:/i.test(raw)
  );
}

function hasClaudeIndicators(raw: string): boolean {
  return /\bClaude\s*:/i.test(raw);
}

function hasGeminiIndicators(raw: string): boolean {
  return /\bGemini\s*:/i.test(raw);
}

function extractInlineReasoning(body: string): {
  content: string;
  reasoning?: string;
} {
  const text = String(body || "").trim();
  if (!text) return { content: "" };

  const leading = text.match(
    /^(?:Thought\s+process|Thinking)\s*:\s*([\s\S]+?)(?:\n{2,}|(?=\n(?:Response|Answer|Final\s+answer)\s*:))([\s\S]*)$/i
  );
  if (leading) {
    const reasoning = leading[1].trim();
    let content = leading[2]
      .trim()
      .replace(/^(?:Response|Answer|Final\s+answer)\s*:\s*/i, "");
    if (reasoning && content) return { content, reasoning };
    if (reasoning && !content) return { content: reasoning, reasoning };
  }

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

function buildAssistantMessage(
  content: string,
  reasoning?: string
): ParsedRawMessage | null {
  const extracted = extractInlineReasoning(content);
  // Prefer trimmed main body; fall back to raw content when it is image-only Markdown.
  let main = String(extracted.content || "").trim();
  if (!main && containsMarkdownImage(content)) {
    main = String(content || "").trim();
  }
  const reasonParts = [reasoning, extracted.reasoning].filter(
    (part): part is string => typeof part === "string" && !!part.trim()
  );
  const mergedReasoning = reasonParts.length
    ? reasonParts.join("\n\n").trim()
    : undefined;

  // Keep image-only assistant turns (no plain text beyond ![alt](url)).
  if (!hasTurnContent(main) && !mergedReasoning) return null;

  if (!hasTurnContent(main) && mergedReasoning) {
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

  return { role: "assistant", content: main };
}

function stripThinkingPrefix(
  content: string,
  knownReasoning?: string
): string {
  const text = String(content || "");
  if (knownReasoning) {
    const prefix = `Thinking:\n${knownReasoning}\n\n`;
    if (text.startsWith(prefix)) return text.slice(prefix.length);
  }
  return text.replace(/^Thinking:\n[\s\S]*?\n\n/, "");
}

/**
 * Parse raw pasted chat text into structured message turns (+ source metadata).
 * Never throws — returns an empty message list on invalid input.
 */
export function parseRawText(text: string): ParseRawTextResult {
  const empty: ParseRawTextResult = {
    source: "Pasted Text",
    title: "Imported Thread",
    messages: [],
  };

  try {
    if (typeof text !== "string") return empty;

    const raw = stripDateTimeHeaders(text.replace(/^\uFEFF/, "").trim());
    if (!raw) return empty;

  const deepSeek = hasDeepSeekIndicators(raw);
  const claude = hasClaudeIndicators(raw);
  const gemini = hasGeminiIndicators(raw);
  let sawChatGpt = false;
  let sawClaude = false;
  let sawDeepSeek = false;
  let sawGemini = false;

  const chunks = raw.split(SPEAKER_SPLIT);
  const messages: ParsedRawMessage[] = [];
  let pendingReasoning: string[] = [];

  function flushReasoningOntoLastAssistant() {
    if (pendingReasoning.length === 0) return;
    const reasoning = pendingReasoning.join("\n\n").trim();
    pendingReasoning = [];
    if (!reasoning) return;

    if (
      messages.length > 0 &&
      messages[messages.length - 1]!.role === "assistant"
    ) {
      const last = messages[messages.length - 1]!;
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

  function appendAssistantMessage(content: string, reasoning?: string) {
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
    let trimmed = chunk.trim();
    if (!trimmed) continue;

    // Drop leading datetime-only preface inside a chunk.
    trimmed = stripDateTimeHeaders(trimmed);
    if (!trimmed) continue;

    const labelMatch = trimmed.match(SPEAKER_LABEL_ONLY);
    if (!labelMatch) {
      if (messages.length > 0) {
        const last = messages[messages.length - 1]!;
        last.content = `${last.content}\n\n${trimmed}`.replace(
          /\n{3,}/g,
          "\n\n"
        );
      } else if (pendingReasoning.length > 0) {
        pendingReasoning[pendingReasoning.length - 1] += `\n${trimmed}`;
      }
      continue;
    }

    const label = labelMatch[1]!;
    const bodyMatch = trimmed.match(SPEAKER_LINE);
    let body = bodyMatch ? bodyMatch[1].trim() : "";
    // Strip accidental date lines that landed in the body (e.g. after label).
    // Never drop Markdown image lines (`![alt](url)`).
    body = body
      .split(/\r?\n/)
      .filter((line) => containsMarkdownImage(line) || !isDateTimeHeaderLine(line))
      .join("\n")
      .trim();

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
      flushReasoningOntoLastAssistant();
      // Keep user turns that are solely image Markdown too.
      if (!hasTurnContent(body)) continue;
      messages.push({ role: "user", content: body });
      continue;
    }

    const reasoning =
      pendingReasoning.length > 0
        ? pendingReasoning.join("\n\n").trim()
        : undefined;
    pendingReasoning = [];
    // Image-only assistant bodies (`![alt](url)` with no other text) must be kept.
    if (!hasTurnContent(body) && !reasoning) continue;
    appendAssistantMessage(body, reasoning);
  }

  flushReasoningOntoLastAssistant();

  const compacted: ParsedRawMessage[] = [];
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

  return { source, title, messages: compacted };
  } catch {
    return empty;
  }
}
