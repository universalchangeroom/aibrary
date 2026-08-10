/** Message shape stored in `threads.content` (jsonb). */
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export type VoteTargetType = "thread" | "footnote";
export type VoteValue = 1 | -1;

/** Row shape for `public.threads`. */
export interface Thread {
  id: string;
  author_id: string;
  title: string;
  content: ChatMessage[];
  source_model: string | null;
  tags: string[];
  is_public: boolean;
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

export function asChatMessages(content: unknown): ChatMessage[] {
  if (!Array.isArray(content)) return [];

  return content.filter((message): message is ChatMessage => {
    if (!message || typeof message !== "object") return false;
    const candidate = message as Record<string, unknown>;
    return (
      typeof candidate.content === "string" &&
      (candidate.role === "user" ||
        candidate.role === "assistant" ||
        candidate.role === "system")
    );
  });
}

export function asFootnotes(value: unknown): Footnote[] {
  return Array.isArray(value) ? (value as Footnote[]) : [];
}
