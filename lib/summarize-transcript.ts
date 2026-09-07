/**
 * Gemini TL;DR for paste/share transcripts.
 * Requires GEMINI_API_KEY (defaults to gemini-flash-latest — 1.5 Flash is retired).
 */

import { GoogleGenAI } from "@google/genai";

import {
  formatGeminiError,
  resolveGeminiModelChain,
  withGeminiModelFallback,
} from "@/lib/gemini-resilience";

/** Same Flash alias used by screenshot OCR — stays current as Google rotates models. */
const DEFAULT_MODEL = "gemini-flash-latest";
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

  const preferred =
    process.env.GEMINI_SUMMARIZE_MODEL?.trim() || DEFAULT_MODEL;
  const models = resolveGeminiModelChain(preferred);
  const clipped =
    trimmed.length > MAX_TRANSCRIPT_CHARS
      ? `${trimmed.slice(0, MAX_TRANSCRIPT_CHARS)}\n\n[Transcript truncated]`
      : trimmed;

  const ai = new GoogleGenAI({ apiKey });

  try {
    return await withGeminiModelFallback({
      models,
      retriesPerModel: 1,
      baseDelayMs: 600,
      run: async (model) => {
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
      },
    });
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message === "Transcript is required." ||
        error.message === "Model returned an empty summary." ||
        error.message.includes("not configured") ||
        error.message.includes("temporarily overloaded"))
    ) {
      throw error;
    }
    throw new Error(formatGeminiError(error, "Summarization request failed."));
  }
}
