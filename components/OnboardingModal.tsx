"use client";

import { useEffect, useState } from "react";

const ONBOARDING_STORAGE_KEY = "chatshare_onboarded";

const concepts = [
  {
    icon: "🏛️",
    title: "Curation Over Clutter",
    description:
      "No algorithmic doomscrolling or comment wars. Just high-signal AI conversations.",
  },
  {
    icon: "🔒",
    title: "Zero-Stress Ingestion",
    description:
      "Transcripts and bulk exports parse locally in your browser memory before you choose what to publish.",
  },
  {
    icon: "🎉",
    title: "The Props Economy",
    description:
      "Appreciation is expressed through scarce weekly Props that naturally decay to encourage active curation.",
  },
] as const;

export function OnboardingModal() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      setIsOpen(localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true");
    } catch {
      setIsOpen(true);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // The modal can still close when browser storage is unavailable.
    }
    setIsOpen(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="chatshare-onboarding-title"
        aria-describedby="chatshare-onboarding-subtitle"
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col gap-6 overflow-y-auto rounded-2xl border border-amber-500/20 bg-stone-900 p-6 text-stone-100 shadow-2xl md:p-8"
      >
        <header>
          <span className="inline-flex rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-amber-300">
            Welcome to ChatShare
          </span>
          <h2
            id="chatshare-onboarding-title"
            className="mt-4 text-2xl font-bold tracking-tight text-white md:text-3xl"
          >
            Publish &amp; Discover Remarkable AI Chats
          </h2>
          <p
            id="chatshare-onboarding-subtitle"
            className="mt-2 leading-relaxed text-stone-400"
          >
            A minimalist, curated archive designed for readability over noise.
          </p>
        </header>

        <ul className="space-y-4">
          {concepts.map((concept) => (
            <li key={concept.title} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-500/10"
              >
                {concept.icon}
              </span>
              <div>
                <h3 className="font-semibold text-stone-100">
                  {concept.title}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-stone-400">
                  {concept.description}
                </p>
              </div>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={dismiss}
          className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 font-semibold text-stone-950 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
        >
          Start Exploring
        </button>
      </section>
    </div>
  );
}

export default OnboardingModal;
