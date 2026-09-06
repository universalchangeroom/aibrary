/**
 * Gemini TL;DR for paste/share transcripts.
 * Requires GEMINI_API_KEY (defaults to gemini-1.5-flash).
 */

import { GoogleGenAI } from "@google/genai";

const DEFAULT_MODEL = "gemini-1.5-flash";
const MAX_TRANSCRIPT_CHARS = 120_000;

const SYSTEM_INSTRUCTION =
  "Write a concise, engaging 1-2 sentence TL;DR of this AI conversation transcript. Do not use filler or meta-announcements. Capture the core problem/inquiry and the primary breakthrough or conclusion.";

export async function summarizeTranscript(transcript: string): Promise<string> {
  const trimmed = String(transcript || "").trim();
  if (!trimmed) {
    throw new Error("Transcript is required.");
  }

  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      "Summarization is not configured. Set GEMINI_API_KEY on the server."
    );
  }

  const model =
    process.env.GEMINI_SUMMARIZE_MODEL?.trim() || DEFAULT_MODEL;
  const clipped =
    trimmed.length > MAX_TRANSCRIPT_CHARS
      ? `${trimmed.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[Transcript truncated]`
      : trimmed;

  const ai = new GoogleGenAI({ apiKey });
  const response = await ai.models.generateContent({
    model,
    contents: clipped,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.4,
    },
  });

  const summary = String(response.text || "").trim();
  if (!summary) {
    throw new Error("Model returned an empty summary.");
  }

  return summary;
}
