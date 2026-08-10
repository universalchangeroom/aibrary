export interface ParsedMessage {
  role: "user" | "assistant";
  content: string;
}

const SPEAKER_SPLIT = /(?=^(?:User|You|AI|Assistant)\s*:)/gim;
const SPEAKER_LINE = /^(User|You|AI|Assistant)\s*:\s*([\s\S]*)$/i;

function roleFromLabel(label: string): "user" | "assistant" {
  const normalized = label.toLowerCase();
  return normalized === "user" || normalized === "you" ? "user" : "assistant";
}

/**
 * Turns a pasted chat transcript into the JSONB message array used by
 * `threads.content`. Speakers are detected from lines that start with
 * `User:`, `You:`, `AI:`, or `Assistant:`.
 */
export function parseTranscript(raw: string): ParsedMessage[] {
  const text = raw.trim();
  if (!text) return [];

  const chunks = text.split(SPEAKER_SPLIT);
  const messages: ParsedMessage[] = [];

  for (const chunk of chunks) {
    const trimmed = chunk.trim();
    if (!trimmed) continue;

    const match = trimmed.match(SPEAKER_LINE);
    if (!match) {
      if (messages.length > 0) {
        messages[messages.length - 1].content += `\n${trimmed}`;
      }
      continue;
    }

    const content = match[2].trim();
    if (!content) continue;

    messages.push({
      role: roleFromLabel(match[1]),
      content,
    });
  }

  return messages;
}

/** Converts a comma-separated tags string into a `text[]`-ready array. */
export function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
