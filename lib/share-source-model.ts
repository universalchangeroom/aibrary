/** Stable platform families used by all share Source Model selects. */
export const SHARE_SOURCE_MODELS = [
  "chatgpt",
  "claude",
  "gemini",
  "copilot",
  "deepseek",
  "meta-ai",
  "grok",
  "perplexity",
  "other",
] as const;

export type ShareSourceModel = (typeof SHARE_SOURCE_MODELS)[number];

/** Clean display labels for stable stored values. */
export const SHARE_SOURCE_MODEL_LABELS: Readonly<
  Record<ShareSourceModel, string>
> = {
  chatgpt: "ChatGPT",
  claude: "Claude",
  gemini: "Gemini",
  copilot: "Microsoft Copilot",
  deepseek: "DeepSeek",
  "meta-ai": "Meta AI",
  grok: "Grok",
  perplexity: "Perplexity",
  other: "Other",
};

function normalizeToken(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "");
}

function matchExactOption(value: string): ShareSourceModel | "" {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const hit = (SHARE_SOURCE_MODELS as readonly string[]).find(
    (option) => option.toLowerCase() === trimmed.toLowerCase()
  );
  if (hit) return hit as ShareSourceModel;

  const labelHit = SHARE_SOURCE_MODELS.find(
    (option) =>
      SHARE_SOURCE_MODEL_LABELS[option].toLowerCase() === trimmed.toLowerCase()
  );
  if (labelHit) return labelHit;

  return "";
}

/**
 * Map bookmarklet `source` / `model` query params (platform names or hostnames)
 * onto a share-form Source Model option.
 */
export function resolveShareSourceModel(
  source?: string | null,
  model?: string | null
): ShareSourceModel | "" {
  const platform = String(source || "").trim();
  const scraped = String(model || "").trim();
  const p = normalizeToken(platform);
  const m = normalizeToken(scraped);
  const combined = `${p} ${m}`.trim();

  const exactScraped = matchExactOption(scraped);
  if (exactScraped) return exactScraped;
  const exactPlatform = matchExactOption(platform);
  if (exactPlatform) return exactPlatform;

  // Model-string hints first (more specific than platform).
  if (/copilot|microsoft\s+copilot/.test(m)) return "copilot";
  if (/grok/.test(m)) return "grok";
  if (/deepseek|deepthink|\br1\b/.test(m)) return "deepseek";
  if (/claude|sonnet|opus|haiku/.test(m)) return "claude";
  if (/gemini|flash|ultra|bard/.test(m)) return "gemini";
  if (/perplexity|sonar/.test(m)) return "perplexity";
  if (/meta[\s-]*ai|\bllama\b/.test(m)) return "meta-ai";
  if (/chatgpt|gpt|o1|o3|o4|openai|\b4o\b/.test(m)) return "chatgpt";

  // Platform / hostname from bookmarklet `source` (or domain fallbacks).
  if (
    p.includes("copilot.microsoft.com") ||
    p.includes("copilot.cloud.microsoft") ||
    p === "copilot" ||
    combined.includes("copilot")
  ) {
    return "copilot";
  }
  if (
    p.includes("chatgpt.com") ||
    p.includes("chat.openai.com") ||
    p === "chatgpt" ||
    p.includes("openai")
  ) {
    return "chatgpt";
  }
  if (p.includes("gemini.google.com") || p === "gemini" || p.includes("gemini")) {
    return "gemini";
  }
  if (p.includes("claude.ai") || p === "claude" || p.includes("claude")) {
    return "claude";
  }
  if (
    p.includes("chat.deepseek.com") ||
    p.includes("deepseek.com") ||
    p === "deepseek" ||
    p.includes("deepseek")
  ) {
    return "deepseek";
  }
  if (
    p === "x.com" ||
    p === "twitter.com" ||
    p.includes("grok.x.ai") ||
    p.includes("grok.com") ||
    p === "grok" ||
    p.includes("grok")
  ) {
    return "grok";
  }
  if (p.includes("perplexity")) return "perplexity";
  if (p.includes("meta.ai") || p === "meta-ai" || p.includes("meta ai")) {
    return "meta-ai";
  }

  if (platform || scraped) return "other";
  return "";
}

/** Canonicalize new values and legacy point-version labels for storage. */
export function normalizeSourceModelForStorage(
  value?: string | null
): ShareSourceModel | null {
  const resolved = resolveShareSourceModel(value);
  return resolved || null;
}

/** Render canonical names for both new slugs and legacy database values. */
export function sourceModelDisplayName(value?: string | null): string {
  const resolved = resolveShareSourceModel(value);
  if (!resolved) return "Other";
  return SHARE_SOURCE_MODEL_LABELS[resolved];
}

/** Read bookmarklet handoff params from the URL and/or sessionStorage. */
export function readBookmarkletSourceModel(
  searchParams: { get(name: string): string | null }
): ShareSourceModel | "" {
  let source = searchParams.get("source")?.trim() || "";
  let model = searchParams.get("model")?.trim() || "";

  if (typeof window !== "undefined") {
    try {
      if (!source) {
        source = sessionStorage.getItem("chatshare_paste_source") || "";
      }
      if (!model) {
        model = sessionStorage.getItem("chatshare_paste_model") || "";
      }
    } catch {
      // ignore storage errors
    }
  }

  return resolveShareSourceModel(source, model);
}
