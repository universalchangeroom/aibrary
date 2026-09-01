/** Fixed options used by share / paste Source Model selects. */
export const SHARE_SOURCE_MODELS = [
  "Claude 3.5 Sonnet",
  "Gemini 1.5 Pro",
  "DeepSeek-R1",
  "GPT-4o",
  "Grok 2",
  "Copilot",
  "Other",
] as const;

export type ShareSourceModel = (typeof SHARE_SOURCE_MODELS)[number];

/** Display labels for options that prefer a friendlier name in the UI. */
export const SHARE_SOURCE_MODEL_LABELS: Partial<
  Record<ShareSourceModel, string>
> = {
  Copilot: "Microsoft Copilot",
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
  if (/^microsoft\s+copilot$/i.test(trimmed)) return "Copilot";
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
  if (/copilot|microsoft\s+copilot/.test(m)) return "Copilot";
  if (/gpt-4o|chatgpt\s*4o|\b4o\b/.test(m)) return "GPT-4o";
  if (/grok/.test(m)) return "Grok 2";
  if (/deepseek|deepthink|\br1\b/.test(m)) return "DeepSeek-R1";
  if (/claude|sonnet|opus|haiku/.test(m)) return "Claude 3.5 Sonnet";
  if (/gemini|flash|ultra/.test(m)) return "Gemini 1.5 Pro";
  if (/chatgpt|gpt|o1|o3|o4|openai/.test(m)) return "GPT-4o";

  // Platform / hostname from bookmarklet `source` (or domain fallbacks).
  if (
    p.includes("copilot.microsoft.com") ||
    p.includes("copilot.cloud.microsoft") ||
    p === "copilot" ||
    combined.includes("copilot")
  ) {
    return "Copilot";
  }
  if (
    p.includes("chatgpt.com") ||
    p.includes("chat.openai.com") ||
    p === "chatgpt" ||
    p.includes("openai")
  ) {
    return "GPT-4o";
  }
  if (p.includes("gemini.google.com") || p === "gemini" || p.includes("gemini")) {
    return "Gemini 1.5 Pro";
  }
  if (p.includes("claude.ai") || p === "claude" || p.includes("claude")) {
    return "Claude 3.5 Sonnet";
  }
  if (
    p.includes("chat.deepseek.com") ||
    p.includes("deepseek.com") ||
    p === "deepseek" ||
    p.includes("deepseek")
  ) {
    return "DeepSeek-R1";
  }
  if (
    p === "x.com" ||
    p === "twitter.com" ||
    p.includes("grok.x.ai") ||
    p.includes("grok.com") ||
    p === "grok" ||
    p.includes("grok")
  ) {
    return "Grok 2";
  }
  if (p.includes("perplexity")) return "Other";

  if (platform || scraped) return "Other";
  return "";
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
