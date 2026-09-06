import { NextResponse } from "next/server";

import { summarizeTranscript } from "@/lib/summarize-transcript";

/** POST { transcript } → { summary } via Gemini 1.5 Flash (GEMINI_API_KEY). */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SummarizeBody = {
  transcript?: unknown;
};

export async function POST(request: Request) {
  let body: SummarizeBody;

  try {
    body = (await request.json()) as SummarizeBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a transcript string." },
      { status: 400 }
    );
  }

  const transcript =
    typeof body.transcript === "string" ? body.transcript.trim() : "";

  if (!transcript) {
    return NextResponse.json(
      { error: "Transcript is required and cannot be empty." },
      { status: 400 }
    );
  }

  try {
    const summary = await summarizeTranscript(transcript);
    return NextResponse.json({ summary }, { status: 200 });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "An unexpected error occurred while summarizing.";

    const status =
      message.includes("not configured") ||
      message.includes("required") ||
      message.includes("empty")
        ? 400
        : 502;

    return NextResponse.json({ error: message }, { status });
  }
}
