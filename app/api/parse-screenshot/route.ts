import { NextResponse } from "next/server";

import { parseScreenshotBuffer } from "@/lib/parse-screenshot";

/** Parses uploaded chat screenshots via Gemini vision (GEMINI_API_KEY, gemini-flash-latest). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FORM_FIELD = "file";

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "Request body must be multipart FormData with an image file.",
      },
      { status: 400 }
    );
  }

  const entry = formData.get(FORM_FIELD);
  if (!(entry instanceof File)) {
    return NextResponse.json(
      {
        success: false,
        error: `Missing image file. Send the screenshot as FormData field "${FORM_FIELD}".`,
      },
      { status: 400 }
    );
  }

  try {
    const buffer = Buffer.from(await entry.arrayBuffer());
    const mimeType = entry.type || "application/octet-stream";
    const parsed = await parseScreenshotBuffer(buffer, mimeType);

    return NextResponse.json(
      {
        success: true,
        data: {
          source: parsed.source,
          title: parsed.title,
          messages: parsed.messages,
          originalUrl: "",
        },
      },
      { status: 200 }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while parsing the screenshot.";

    const status =
      message.includes("not configured") ||
      message.includes("Unsupported") ||
      message.includes("too large") ||
      message.includes("empty")
        ? 400
        : 422;

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
