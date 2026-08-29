/**
 * Explicit DeepSeek-style thought blocks embedded in assistant message content.
 * Format: <think>…multi-paragraph markdown…</think> then the main reply.
 */

const THINK_BLOCK_RE = /<think>([\s\S]*?)<\/think>/gi;

export function hasThoughtProcess(content: string): boolean {
  THINK_BLOCK_RE.lastIndex = 0;
  return THINK_BLOCK_RE.test(content);
}

/**
 * Extract all <think>…</think> regions (tags stripped) and return the remaining
 * main reply. If no tags are present, body is the original content unchanged.
 */
export function splitThoughtProcess(content: string): {
  thought: string | null;
  body: string;
} {
  if (!content) return { thought: null, body: content };

  THINK_BLOCK_RE.lastIndex = 0;
  if (!THINK_BLOCK_RE.test(content)) {
    return { thought: null, body: content };
  }

  const thoughts: string[] = [];
  THINK_BLOCK_RE.lastIndex = 0;
  const body = content
    .replace(THINK_BLOCK_RE, (_full, inner: string) => {
      const trimmed = String(inner ?? "").trim();
      if (trimmed) thoughts.push(trimmed);
      return "";
    })
    .replace(/^\s*\n+/, "")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd();

  return {
    thought: thoughts.length > 0 ? thoughts.join("\n\n") : null,
    body,
  };
}

/** Strip every <think> block, leaving only the main reply text. */
export function stripThoughtProcess(content: string): string {
  if (!content) return content;
  if (!hasThoughtProcess(content)) return content;
  return splitThoughtProcess(content).body;
}

/** Embed reasoning in explicit tags ahead of the main assistant reply. */
export function wrapThoughtProcess(thought: string, body: string): string {
  const t = thought.trim();
  const b = body.trim();
  if (!t) return b;
  if (!b) return `<think>\n${t}\n</think>`;
  return `<think>\n${t}\n</think>\n\n${b}`;
}
