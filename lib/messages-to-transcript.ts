export type LabeledMessage = {
  role: "user" | "assistant";
  content: string;
};

/** Speaker label for assistant turns when rebuilding a labeled paste transcript. */
export function assistantLabelFromSource(source: string): string {
  const s = source.trim().toLowerCase();
  if (s.includes("gemini")) return "Gemini";
  if (s.includes("claude")) return "Claude";
  if (s.includes("deepseek")) return "DeepSeek";
  if (s.includes("chatgpt") || s.includes("gpt") || s.includes("openai")) {
    return "ChatGPT";
  }
  return "Assistant";
}

/**
 * Rebuild `User:\n…\n\nChatGPT:\n…` text for TipTap + parseRawText preview.
 */
export function messagesToLabeledTranscript(
  messages: LabeledMessage[],
  source = "ChatGPT"
): string {
  const aiLabel = assistantLabelFromSource(source);

  return messages
    .filter((m) => typeof m.content === "string" && m.content.trim().length > 0)
    .map((m) => {
      const label = m.role === "user" ? "User" : aiLabel;
      return `${label}:\n${m.content.trim()}`;
    })
    .join("\n\n");
}
