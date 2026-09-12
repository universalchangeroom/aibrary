"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { createClient } from "@/lib/supabase/client";
import type { ReportReason } from "@/lib/types";
import { cn } from "@/lib/utils";

const REPORT_OPTIONS: { reason: ReportReason; label: string }[] = [
  { reason: "SPAM", label: "Spam / Low Quality" },
  { reason: "PII", label: "Sensitive Info (PII)" },
  { reason: "DANGER", label: "Harmful / Dangerous" },
  { reason: "OTHER", label: "Other" },
];

type SubmitPhase = "idle" | "filing" | "success";

interface ReportThreadModalProps {
  threadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ReportThreadModal({
  threadId,
  open,
  onOpenChange,
}: ReportThreadModalProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [selectedReason, setSelectedReason] = useState<ReportReason | null>(
    null
  );
  const [phase, setPhase] = useState<SubmitPhase>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    setSelectedReason(null);
    setPhase("idle");
    setError(null);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && phase !== "filing") {
        onOpenChange(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onOpenChange, phase]);

  async function handleSubmit() {
    if (!selectedReason || phase === "filing" || phase === "success") return;

    if (!user) {
      setError("Sign in to file a report.");
      return;
    }

    setError(null);
    setPhase("filing");

    try {
      const supabase = createClient();
      const { error: insertError } = await supabase.from("reports").insert({
        thread_id: threadId,
        reporter_id: user.id,
        reason: selectedReason,
      });

      if (insertError) {
        throw insertError;
      }

      setPhase("success");
      window.setTimeout(() => {
        onOpenChange(false);
      }, 1200);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not submit your report.";
      setError(message);
      setPhase("idle");
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="presentation"
      onClick={() => {
        if (phase !== "filing") onOpenChange(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-thread-title"
        aria-describedby="report-thread-subtitle"
        className="relative w-full max-w-sm rounded-3xl border border-white/20 bg-white/10 p-8 shadow-[0_0_40px_rgba(139,92,246,0.3)] backdrop-blur-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Close report modal"
          className="absolute right-4 top-4 rounded-full p-1 text-white/50 transition-colors hover:text-white"
          onClick={() => {
            if (phase !== "filing") onOpenChange(false);
          }}
          disabled={phase === "filing"}
        >
          <X className="h-5 w-5" />
        </button>

        <h2
          id="report-thread-title"
          className="mb-2 text-2xl font-bold text-white"
        >
          Report Thread
        </h2>
        <p id="report-thread-subtitle" className="mb-6 text-white/60">
          Help keep the carousel safe.
        </p>

        <div className="flex flex-col" role="radiogroup" aria-label="Report reason">
          {REPORT_OPTIONS.map((option) => {
            const selected = selectedReason === option.reason;
            return (
              <button
                key={option.reason}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={phase === "filing" || phase === "success"}
                onClick={() => setSelectedReason(option.reason)}
                className={cn(
                  "mb-3 cursor-pointer rounded-xl border px-4 py-3 text-left transition-all",
                  selected
                    ? "border-pink-500 bg-pink-500/20 text-white shadow-[0_0_15px_rgba(236,72,153,0.4)]"
                    : "border-white/10 bg-black/30 text-white/70 hover:border-pink-500/50 hover:bg-pink-500/10"
                )}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {error ? (
          <p role="alert" className="mb-3 text-sm text-pink-300">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!selectedReason || phase === "filing" || phase === "success"}
          onClick={() => void handleSubmit()}
          className="w-full rounded-xl bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-400 py-3 font-bold text-white transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
        >
          {phase === "filing" ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Filing…
            </span>
          ) : phase === "success" ? (
            "Ticket Submitted"
          ) : (
            "Submit Ticket"
          )}
        </button>

        <button
          type="button"
          className="mt-4 w-full text-center text-sm text-white/50 transition-colors hover:text-white/80 disabled:opacity-50"
          onClick={() => onOpenChange(false)}
          disabled={phase === "filing"}
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body
  );
}
