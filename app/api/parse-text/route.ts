import { NextResponse } from "next/server";

import { parseRawText } from "../../../parserService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ParseTextBody {
  text?: unknown;
  pageUrl?: unknown;
}

/** CORS so the ChatShare bookmarklet can call this from chat provider tabs. */
function withCors(response: NextResponse): NextResponse {
  response.headers.set("Access-Control-Allow-Origin", "*");
  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  return response;
}

function json(body: unknown, status = 200): NextResponse {
  return withCors(NextResponse.json(body, { status }));
}

export async function OPTIONS() {
  return withCors(new NextResponse(null, { status: 204 }));
}

/**
 * POST /api/parse-text
 * Body: { text: string, pageUrl?: string }
 *
 * Parses pasted chat transcripts into structured message turns via parserService.
 * Also used by the browser bookmarklet (cross-origin).
 */
export async function POST(request: Request) {
  let body: ParseTextBody;

  try {
    body = (await request.json()) as ParseTextBody;
  } catch {
    return json(
      {
        success: false,
        error: "Request body must be valid JSON.",
      },
      400
    );
  }

  if (typeof body.text !== "string" || !body.text.trim()) {
    return json(
      {
        success: false,
        error: "A non-empty text string is required.",
      },
      400
    );
  }

  try {
    const parsed = parseRawText(body.text) as {
      source?: string;
      title?: string;
      messages?: Array<{ role: string; content: string; reasoning?: string }>;
    };

    const messages = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed.messages)
        ? parsed.messages
        : [];

    if (messages.length === 0) {
      return json(
        {
          success: false,
          error:
            'Could not detect speaker turns. Use labels like "User:" / "You:" and "Gemini:" / "DeepSeek:" / "Claude:" / "ChatGPT:" / "Assistant:".',
        },
        422
      );
    }

    let source =
      !Array.isArray(parsed) && typeof parsed.source === "string"
        ? parsed.source
        : "Pasted Text";
    let title =
      !Array.isArray(parsed) && typeof parsed.title === "string"
        ? parsed.title
        : source === "DeepSeek"
          ? "Imported DeepSeek Thread"
          : source === "Gemini"
            ? "Imported Gemini Thread"
            : source === "Claude"
              ? "Imported Claude Thread"
              : "Imported Thread";

    const pageUrl =
      typeof body.pageUrl === "string" ? body.pageUrl.trim() : "";

    // Prefer page host when parse didn't already detect a brand.
    if (source === "Pasted Text" && pageUrl) {
      try {
        const host = new URL(pageUrl).hostname.toLowerCase();
        if (host.includes("chatgpt") || host.includes("openai")) {
          source = "ChatGPT";
        } else if (host.includes("claude")) {
          source = "Claude";
        } else if (host.includes("deepseek")) {
          source = "DeepSeek";
        } else if (host.includes("gemini.google")) {
          source = "Gemini";
        } else if (host.includes("perplexity.ai")) {
          source = "Perplexity";
        } else if (host.includes("copilot.microsoft") || host.includes("copilot.cloud.microsoft")) {
          source = "Copilot";
        } else if (
          host === "x.com" ||
          host === "www.x.com" ||
          host.includes("grok.com") ||
          host.includes("grok.x.ai")
        ) {
          source = "Grok";
        }
      } catch {
        // ignore invalid pageUrl
      }
    }

    if (source === "DeepSeek" && title === "Imported Thread") {
      title = "Imported DeepSeek Thread";
    }
    if (source === "Gemini" && title === "Imported Thread") {
      title = "Imported Gemini Thread";
    }
    if (source === "Claude" && title === "Imported Thread") {
      title = "Imported Claude Thread";
    }
    if (source === "Perplexity" && title === "Imported Thread") {
      title = "Imported Perplexity Thread";
    }
    if (source === "ChatGPT" && title === "Imported Thread") {
      title = "Imported ChatGPT Thread";
    }

    return json(
      {
        success: true,
        data: {
          source,
          title,
          messages,
          originalUrl: pageUrl || undefined,
        },
      },
      200
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while parsing the text.";

    return json(
      {
        success: false,
        error: message,
      },
      422
    );
  }
}
