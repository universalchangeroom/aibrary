/**
 * Shared Gemini error parsing + retry/fallback for transient capacity errors.
 */

export function formatGeminiError(
  error: unknown,
  fallback = "Gemini request failed."
): string {
  if (!(error instanceof Error)) return fallback;

  const raw = error.message.trim();
  if (!raw) return fallback;

  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as {
        error?: { message?: string; status?: string; code?: number };
        message?: string;
      };
      const nested = parsed.error?.message || parsed.message;
      if (typeof nested === "string" && nested.trim()) {
        return nested.trim();
      }
    } catch {
      // fall through
    }
  }

  return raw;
}

/** True for temporary capacity / overload / rate-limit style failures. */
export function isTransientGeminiError(error: unknown): boolean {
  const message = formatGeminiError(error).toLowerCase();
  const raw =
    error instanceof Error ? error.message.toLowerCase() : String(error || "");

  return (
    message.includes("high demand") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("capacity") ||
    message.includes("try again later") ||
    message.includes("resource_exhausted") ||
    message.includes("rate limit") ||
    message.includes("quota") ||
    raw.includes('"code":503') ||
    raw.includes('"code": 503') ||
    raw.includes('"code":429') ||
    raw.includes('"code": 429') ||
    raw.includes("unavailable") ||
    raw.includes("resource_exhausted")
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Build an ordered unique model list: preferred first, then fallbacks from env / defaults.
 */
export function resolveGeminiModelChain(
  preferred: string,
  fallbackEnv?: string
): string[] {
  const fromEnv = (fallbackEnv || process.env.GEMINI_FALLBACK_MODELS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const defaults = [
    "gemini-2.0-flash",
    "gemini-2.5-flash",
    "gemini-2.0-flash-lite",
  ];

  const seen = new Set<string>();
  const chain: string[] = [];
  for (const id of [preferred, ...fromEnv, ...defaults]) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    chain.push(id);
  }
  return chain;
}

/**
 * Try models in order. On transient failures, retry once with backoff then move on.
 */
export async function withGeminiModelFallback<T>(options: {
  models: string[];
  run: (model: string) => Promise<T>;
  retriesPerModel?: number;
  baseDelayMs?: number;
}): Promise<T> {
  const retriesPerModel = options.retriesPerModel ?? 1;
  const baseDelayMs = options.baseDelayMs ?? 700;
  let lastError: unknown;

  for (let modelIndex = 0; modelIndex < options.models.length; modelIndex++) {
    const model = options.models[modelIndex]!;
    const attempts = 1 + retriesPerModel;

    for (let attempt = 0; attempt < attempts; attempt++) {
      try {
        return await options.run(model);
      } catch (error) {
        lastError = error;
        if (!isTransientGeminiError(error)) {
          throw error instanceof Error
            ? error
            : new Error(formatGeminiError(error));
        }

        const hasRetryLeft = attempt < attempts - 1;
        const hasNextModel = modelIndex < options.models.length - 1;
        if (hasRetryLeft) {
          const delay =
            baseDelayMs * Math.pow(2, attempt) +
            Math.floor(Math.random() * 200);
          await sleep(delay);
          continue;
        }
        if (hasNextModel) break;
      }
    }
  }

  const detail = formatGeminiError(lastError);
  throw new Error(
    detail.includes("high demand") || detail.includes("unavailable")
      ? "Gemini is temporarily overloaded. Please try again in a moment."
      : detail || "Gemini request failed after retries."
  );
}
