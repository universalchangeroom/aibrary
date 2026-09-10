"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/components/providers/auth-provider";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ONBOARDING_STORAGE_KEY = "chatshare_onboarded";
const USERNAME_RE = /^[a-z0-9_]+$/;
const USERNAME_MIN = 3;
const USERNAME_MAX = 20;

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

function normalizeUsernameInput(value: string): string {
  return value.trim().toLowerCase();
}

function usernameFormatError(value: string): string | null {
  if (!value) return null;
  if (/\s/.test(value) || !USERNAME_RE.test(value)) {
    return "Lowercase letters, numbers, and underscores only — no spaces or special characters.";
  }
  if (value.length < USERNAME_MIN) {
    return `Username must be at least ${USERNAME_MIN} characters.`;
  }
  if (value.length > USERNAME_MAX) {
    return `Username must be ${USERNAME_MAX} characters or fewer.`;
  }
  return null;
}

export function OnboardingModal() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [needsUsername, setNeedsUsername] = useState(false);
  const [isCheckingProfile, setIsCheckingProfile] = useState(true);
  const [username, setUsername] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formatError = useMemo(
    () => usernameFormatError(normalizeUsernameInput(username)),
    [username]
  );
  const canSubmitUsername =
    Boolean(normalizeUsernameInput(username)) &&
    !formatError &&
    !isSubmitting;

  useEffect(() => {
    let cancelled = false;

    async function resolveOnboardingState() {
      if (isAuthLoading) return;

      setIsCheckingProfile(true);

      try {
        let alreadyOnboarded = false;
        try {
          alreadyOnboarded =
            localStorage.getItem(ONBOARDING_STORAGE_KEY) === "true";
        } catch {
          alreadyOnboarded = false;
        }

        if (!user) {
          if (!cancelled) {
            setNeedsUsername(false);
            setIsOpen(!alreadyOnboarded);
          }
          return;
        }

        const supabase = createClient();
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("id", user.id)
          .maybeSingle();

        const existingUsername =
          typeof profile?.username === "string"
            ? profile.username.trim()
            : "";
        const missingUsername = !existingUsername;

        if (!cancelled) {
          setNeedsUsername(missingUsername);
          setIsOpen(missingUsername || !alreadyOnboarded);
        }
      } catch {
        if (!cancelled) {
          setNeedsUsername(Boolean(user));
          setIsOpen(true);
        }
      } finally {
        if (!cancelled) {
          setIsCheckingProfile(false);
        }
      }
    }

    void resolveOnboardingState();

    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, user]);

  function completeOnboarding() {
    try {
      localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    } catch {
      // Still allow dismissal if browser storage is unavailable.
    }
    setNeedsUsername(false);
    setIsOpen(false);
  }

  function dismiss() {
    if (needsUsername) return;
    completeOnboarding();
  }

  async function handleClaimUsername(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || isSubmitting) return;

    const nextUsername = normalizeUsernameInput(username);
    const validationError = usernameFormatError(nextUsername);
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = createClient();
      const { data: existing, error: lookupError } = await supabase
        .from("profiles")
        .select("id")
        .eq("username", nextUsername)
        .neq("id", user.id)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing) {
        setSubmitError("Username is already claimed");
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ username: nextUsername })
        .eq("id", user.id);

      if (updateError) {
        if (updateError.code === "23505") {
          setSubmitError("Username is already claimed");
          return;
        }
        throw updateError;
      }

      completeOnboarding();
    } catch (cause) {
      setSubmitError(
        cause instanceof Error
          ? cause.message
          : "Could not save your username. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isAuthLoading || isCheckingProfile || !isOpen) {
    return null;
  }

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

        {needsUsername ? (
          <form onSubmit={(event) => void handleClaimUsername(event)} className="space-y-3">
            <div className="space-y-2">
              <label
                htmlFor="onboarding-username"
                className="text-sm font-medium text-stone-200"
              >
                Choose a permanent username
              </label>
              <input
                id="onboarding-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setSubmitError(null);
                }}
                placeholder="your_handle"
                maxLength={USERNAME_MAX}
                disabled={isSubmitting}
                aria-invalid={Boolean(formatError || submitError)}
                aria-describedby="onboarding-username-help onboarding-username-error"
                className={cn(
                  "flex h-11 w-full rounded-xl border bg-stone-950/60 px-3 text-sm text-stone-100 placeholder:text-stone-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400",
                  formatError || submitError
                    ? "border-rose-400/70"
                    : "border-amber-500/30"
                )}
              />
              <p
                id="onboarding-username-help"
                className="text-xs text-stone-400"
              >
                Lowercase letters, numbers, and underscores only. 3–20
                characters. This cannot be changed later.
              </p>
              {formatError || submitError ? (
                <p
                  id="onboarding-username-error"
                  role="alert"
                  className="text-sm font-medium text-rose-300"
                >
                  {submitError || formatError}
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={!canSubmitUsername}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 font-semibold text-stone-950 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Claiming…
                </>
              ) : (
                "Claim Username & Start Exploring"
              )}
            </button>
          </form>
        ) : (
          <button
            type="button"
            onClick={dismiss}
            className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 py-3 font-semibold text-stone-950 transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-stone-900"
          >
            Start Exploring
          </button>
        )}
      </section>
    </div>
  );
}

export default OnboardingModal;
