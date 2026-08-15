/** Message shape stored in `threads.content` (jsonb). */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type VoteTargetType = "thread" | "footnote";
export type VoteValue = 1 | -1;

/** Moderation status for public feed visibility. */
export type ThreadStatus = "published" | "pending_review";

/** Row shape for `public.threads`. */
export interface Thread {
  id: string;
  author_id: string;
  title: string;
  content: ChatMessage[];
  source_model: string | null;
  tags: string[];
  is_public: boolean;
  /** published = public feed; pending_review = image content awaiting admin */
  status?: ThreadStatus | string;
  created_at: string;
  updated_at: string;
}

/** Row shape for `public.footnotes`. */
export interface Footnote {
  id: string;
  thread_id: string;
  author_id: string;
  quoted_text: string | null;
  body: string;
  source_url: string | null;
  created_at: string;
}

export type FootnoteWithVotes = Footnote & {
  score: number;
  userVote: VoteValue | null;
};

/** Thread row with nested footnotes and vote summary. */
export type ThreadWithFootnotes = Thread & {
  footnotes: FootnoteWithVotes[];
  score: number;
  userVote: VoteValue | null;
};

function normalizeRole(value: unknown): ChatMessage["role"] | null {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (raw === "user" || raw === "you" || raw === "human") return "user";
  if (
    raw === "assistant" ||
    raw === "ai" ||
    raw === "model" ||
    raw === "chatgpt" ||
    raw === "claude" ||
    raw === "gemini" ||
    raw === "deepseek" ||
    raw === "system"
  ) {
    return raw === "system" ? "system" : "assistant";
  }
  return null;
}

function messageTextFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((part) => messageTextFromUnknown(part)).join("");
  }
  if (!value || typeof value !== "object") return "";
  const rec = value as Record<string, unknown>;
  if (typeof rec.text === "string") return rec.text;
  if (typeof rec.content === "string") return rec.content;
  if (typeof rec.markdown === "string") return rec.markdown;
  if (Array.isArray(rec.parts)) return messageTextFromUnknown(rec.parts);
  if (Array.isArray(rec.content)) return messageTextFromUnknown(rec.content);
  return "";
}

function coerceMessageList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      return coerceMessageList(JSON.parse(trimmed));
    } catch {
      return [];
    }
  }
  if (!value || typeof value !== "object") return [];
  const rec = value as Record<string, unknown>;
  if (Array.isArray(rec.messages)) return rec.messages;
  if (Array.isArray(rec.content)) return rec.content;
  const keys = Object.keys(rec);
  if (keys.length > 0 && keys.every((key) => /^\d+$/.test(key))) {
    return keys
      .sort((a, b) => Number(a) - Number(b))
      .map((key) => rec[key]);
  }
  return [];
}

/**
 * Normalize `public.threads.content` (jsonb message array) for the feed view.
 * Accepts arrays, JSON strings, `{ messages: [...] }` wrappers, and `text` aliases
 * so stored transcripts are not dropped when the shape is slightly off.
 */
export function asChatMessages(content: unknown): ChatMessage[] {
  const list = coerceMessageList(content);
  const messages: ChatMessage[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const role = normalizeRole(candidate.role ?? candidate.author ?? candidate.speaker);
    const text = messageTextFromUnknown(
      candidate.content ??
        candidate.text ??
        candidate.markdown ??
        candidate.body ??
        candidate.transcript
    );
    if (!role || !text.trim()) continue;
    messages.push({ role, content: text });
  }

  return messages;
}

/**
 * Pull the transcript payload off a threads row / publish body.
 * Canonical DB column is `content` (not transcript / markdown).
 */
export function threadContentFromRow(
  row: Record<string, unknown> | null | undefined
): unknown {
  if (!row) return [];
  if (row.content != null) return row.content;
  if (row.messages != null) return row.messages;
  if (row.transcript != null) return row.transcript;
  return [];
}

export function asFootnotes(value: unknown): Footnote[] {
  return Array.isArray(value) ? (value as Footnote[]) : [];
}
