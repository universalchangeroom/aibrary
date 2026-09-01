/**
 * Server-side vision extraction for mobile chat scrolling screenshots.
 * Requires GEMINI_API_KEY (uses gemini-flash-latest by default).
 */

import { GoogleGenAI, Type } from "@google/genai";

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

const RESPONSE_JSON_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "Short descriptive title for the thread",
    },
    source: {
      type: Type.STRING,
      description:
        'Identified chat app: "ChatGPT", "Claude", "Gemini", "DeepSeek", or "Screenshot"',
    },
    messages: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          role: {
            type: Type.STRING,
            description: 'Either "user" or "assistant"',
          },
          content: {
            type: Type.STRING,
            description: "Markdown transcript for this turn",
          },
        },
        required: ["role", "content"],
        propertyOrdering: ["role", "content"],
      },
    },
  },
  required: ["title", "messages"],
  propertyOrdering: ["title", "source", "messages"],
} as const;

/** Google's auto-updating Flash alias — no pinned version numbers. */
const DEFAULT_MODEL = "gemini-flash-latest";

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

function extractJsonPayload(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) {
    return trimmed;
  }

  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  return trimmed;
}

function parseVisionJson(raw: string): ScreenshotParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJsonPayload(raw));
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
 * Send an image buffer to Gemini and return structured turns.
 */
export async function parseScreenshotBuffer(
  buffer: Buffer,
  mimeType: string
): Promise<ScreenshotParseResult> {
  assertScreenshotMime(mimeType);
  assertScreenshotSize(buffer.length);

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Screenshot import is not configured. Set GEMINI_API_KEY on the server."
    );
  }

  const model =
    process.env.GEMINI_VISION_MODEL?.trim() || DEFAULT_MODEL;
  const normalizedMime =
    mimeType.toLowerCase().split(";")[0]?.trim() ?? "image/png";
  const base64 = buffer.toString("base64");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          inlineData: {
            mimeType: normalizedMime,
            data: base64,
          },
        },
        {
          text: "Extract the full conversation from this mobile chat screenshot.",
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.1,
        responseMimeType: "application/json",
        responseJsonSchema: RESPONSE_JSON_SCHEMA,
      },
    });

    const content = response.text;
    if (typeof content !== "string" || !content.trim()) {
      throw new Error("Vision model returned an empty response.");
    }

    return parseVisionJson(content);
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error("Vision API request failed.");
  }
}
