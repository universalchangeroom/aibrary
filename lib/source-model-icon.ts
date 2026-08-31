export type SourceModelPlatform =
  | "gemini"
  | "copilot"
  | "deepseek"
  | "grok"
  | "claude"
  | "chatgpt"
  | "poe"
  | "perplexity"
  | "unknown";

const FAVICON_DOMAINS: Record<
  Exclude<SourceModelPlatform, "unknown">,
  string
> = {
  gemini: "gemini.google.com",
  copilot: "copilot.microsoft.com",
  deepseek: "chat.deepseek.com",
  grok: "grok.com",
  claude: "claude.ai",
  chatgpt: "chatgpt.com",
  poe: "poe.com",
  perplexity: "perplexity.ai",
};

/** Map a stored source_model label to a supported platform key. */
export function resolveSourceModelPlatform(
  sourceModel: string
): SourceModelPlatform {
  const model = sourceModel.trim().toLowerCase();
  if (!model) return "unknown";

  if (/gemini|flash|ultra|bard/.test(model)) return "gemini";
  if (/copilot|microsoft/.test(model)) return "copilot";
  if (/deepseek|deepthink|\br1\b/.test(model)) return "deepseek";
  if (/\bgrok\b/.test(model)) return "grok";
  if (/claude|sonnet|opus|haiku/.test(model)) return "claude";
  if (/chatgpt|\bgpt\b|openai|\b4o\b|\bo[134]\b/.test(model)) return "chatgpt";
  if (/\bpoe\b/.test(model)) return "poe";
  if (/perplexity/.test(model)) return "perplexity";

  return "unknown";
}

/** Google favicon URL for the matched platform, or null for unknown/custom models. */
export function sourceModelFaviconUrl(sourceModel: string): string | null {
  const platform = resolveSourceModelPlatform(sourceModel);
  if (platform === "unknown") return null;

  const domain = FAVICON_DOMAINS[platform];
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}
