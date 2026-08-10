import { NextResponse } from "next/server";

import {
  importLinkFromUrl,
  InvalidLinkError,
  ParseError,
} from "@/lib/import-link";
import {
  parseChatGPTShareLink,
  parseDeepSeekShareLink,
} from "../../../parserService.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ImportLinkBody {
  url?: unknown;
}

const CHATGPT_PATTERN =
  /^https?:\/\/(?:www\.)?(?:chatgpt\.com|chat\.openai\.com)\/share\/[a-zA-Z0-9._-]+\/?$/i;

const DEEPSEEK_PATTERN =
  /^https?:\/\/(?:www\.)?chat\.deepseek\.com\/share\/[a-zA-Z0-9._-]+\/?$/i;

/**
 * POST /api/import-link
 * Body: { url: string }
 *
 * ChatGPT + DeepSeek share links are routed through parserService
 * (direct fetch + CORS proxy fallback). Other platforms use the shared
 * import-link parsers.
 */
export async function POST(request: Request) {
  let body: ImportLinkBody;

  try {
    body = (await request.json()) as ImportLinkBody;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Invalid Link",
        message: "Request body must be valid JSON.",
      },
      { status: 400 }
    );
  }

  const url = typeof body.url === "string" ? body.url.trim() : "";

  if (!url) {
    return NextResponse.json(
      {
        success: false,
        error: "A valid URL string is required.",
      },
      { status: 400 }
    );
  }

  try {
    if (CHATGPT_PATTERN.test(url)) {
      const data = await parseChatGPTShareLink(url);
      return NextResponse.json(
        {
          success: true,
          data,
        },
        { status: 200 }
      );
    }

    if (DEEPSEEK_PATTERN.test(url)) {
      const data = await parseDeepSeekShareLink(url);
      return NextResponse.json(
        {
          success: true,
          data,
        },
        { status: 200 }
      );
    }

    const result = await importLinkFromUrl(url);
    return NextResponse.json(
      {
        success: true,
        data: {
          source: result.source,
          verified: true,
          originalUrl: result.originalUrl,
          title: result.title,
          messages: result.messages,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof InvalidLinkError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message || "Invalid Link",
        },
        { status: 400 }
      );
    }

    if (error instanceof ParseError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        { status: 422 }
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to import share link.";

    console.error("[import-link]", error);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 422 }
    );
  }
}
