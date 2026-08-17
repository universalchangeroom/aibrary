/**
 * Server-side vision extraction for mobile chat scrolling screenshots.
 * Requires OPENAI_API_KEY (uses gpt-4o-mini by default).
 */

export type ScreenshotParseResult = {
  title: string;
  source: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
};

const SYSTEM_PROMPT = `You extract structured chat transcripts from mobile AI chat screenshots.

Rules:
- Identify each conversation turn and assign role "user" or "assistant".
- Transcribe ALL visible text accurately.
- Preserve Markdown: fenced code blocks (\`\`\`), inline \`code\`, bullet/numbered lists, bold, italics, and line breaks.
- Do NOT invent content that is not visible in the image.
- Merge continuation bubbles that belong to the same speaker into one message.
- Ignore UI chrome: status bars, keyboards, nav bars, timestamps, and "You said"/"ChatGPT said" labels unless they are the only content.
- If the app is identifiable (ChatGPT, Claude, Gemini, DeepSeek), set source accordingly; otherwise use "Screenshot".

Return ONLY valid JSON with this exact shape:
{
  "title": "short descriptive title for the thread",
  "source": "ChatGPT" | "Claude" | "Gemini" | "DeepSeek" | "Screenshot",
  "messages": [
    { "role": "user" | "assistant", "content": "markdown string" }
  ]
}`;

const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

const MAX_BYTES = 10 * 1024 * 1024;

function normalizeRole(value: unknown): "user" | "assistant" | null {
  const role = String(value || "").toLowerCase();
  if (role === "user" || role === "human" || role === "you") return "user";
  if (
    role === "assistant" ||
    role === "ai" ||
    role === "chatgpt" ||
    role === "claude" ||
    role === "gemini" ||
    role === "model"
  ) {
    return "assistant";
  }
  return null;
}

function sanitizeContent(text: string): string {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseVisionJson(raw: string): ScreenshotParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("Vision model returned invalid JSON.");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("Vision model returned an unexpected payload.");
  }

  const record = parsed as Record<string, unknown>;
  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title.trim().slice(0, 200)
      : "Imported Screenshot Thread";

  const source =
    typeof record.source === "string" && record.source.trim()
      ? record.source.trim()
      : "Screenshot";

  const rawMessages = Array.isArray(record.messages) ? record.messages : [];
  const messages: ScreenshotParseResult["messages"] = [];

  for (const item of rawMessages) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const role = normalizeRole(row.role);
    const content = sanitizeContent(String(row.content ?? ""));
    if (!role || !content) continue;
    messages.push({ role, content });
  }

  if (messages.length === 0) {
    throw new Error(
      "No conversation turns were detected in this screenshot. Try a clearer, uncropped image."
    );
  }

  return { title, source, messages };
}

export function assertScreenshotMime(mime: string): void {
  const normalized = mime.toLowerCase().split(";")[0]?.trim() ?? "";
  if (!ALLOWED_MIME.has(normalized)) {
    throw new Error("Unsupported image type. Use PNG, JPG, or WebP.");
  }
}

export function assertScreenshotSize(byteLength: number): void {
  if (byteLength <= 0) {
    throw new Error("The uploaded image is empty.");
  }
  if (byteLength > MAX_BYTES) {
    throw new Error("Image is too large. Maximum size is 10 MB.");
  }
}

/**
 * Send an image buffer to a lightweight multimodal model and return structured turns.
 */
export async function parseScreenshotBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ScreenshotParseResult> {
  assertScreenshotMime(mimeType);
  assertScreenshotSize(buffer.length);

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Screenshot import is not configured. Set OPENAI_API_KEY on the server."
    );
  }

  const model =
    process.env.OPENAI_VISION_MODEL?.trim() || "gpt-4o-mini";
  const normalizedMime = mimeType.toLowerCase().split(";")[0]?.trim() ?? "image/png";
  const base64 = buffer.toString("base64");
  const dataUrl = `data:${normalizedMime};base64,${base64}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      response_format: { type: "json_object" },
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the full conversation from this mobile chat screenshot.",
            },
            {
              type: "image_url",
              image_url: { url: dataUrl, detail: "high" },
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    choices?: Array<{ message?: { content?: string } }>;
  } | null;

  if (!response.ok) {
    const detail =
      payload?.error?.message ||
      `Vision API request failed (${response.status}).`;
    throw new Error(detail);
  }

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new Error("Vision model returned an empty response.");
  }

  return parseVisionJson(content);
}
