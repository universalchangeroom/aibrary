"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Cinzel, Source_Sans_3 } from "next/font/google";
import { Loader2 } from "lucide-react";

import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const displaySerif = Cinzel({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-carousel-serif",
});

const bodySans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-carousel-sans",
});

function SpiralMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M60 18c23 0 42 19 42 42s-19 42-42 42-42-19-42-42c0-16 9-30 22-37"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 34c14 0 26 12 26 26s-12 26-26 26-26-12-26-26c0-10 5-18 13-23"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 48c7 0 12 5 12 12s-5 12-12 12-12-5-12-12c0-4 2-8 6-10"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="4" fill="currentColor" />
    </svg>
  );
}

const fieldClassName =
  "w-full border-0 border-b border-rose-200/50 bg-transparent px-0 py-2.5 text-base text-white placeholder:text-rose-100/45 shadow-[0_1px_0_rgba(251,207,232,0.35)] outline-none transition focus:border-rose-200 focus:shadow-[0_2px_12px_rgba(251,113,133,0.35)]";

export function CarouselSignUpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/feed";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const trimmedName = name.trim();
    const trimmedEmail = email.trim();

    if (!trimmedName) {
      setError("Please enter your name.");
      return;
    }
    if (!trimmedEmail) {
      setError("Please enter your email.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          data: {
            full_name: trimmedName,
          },
        },
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        router.push(nextPath);
        router.refresh();
        return;
      }

      setInfo(
        "Account created. Check your email to confirm your address, then sign in."
      );
      setIsSubmitting(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not create your account.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className={cn(
        displaySerif.variable,
        bodySans.variable,
        "fixed inset-0 z-[60] flex h-screen w-screen items-center justify-center overflow-hidden bg-[#12061d] bg-[url('/carousel-signup-bg.jpg')] bg-cover bg-center"
      )}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-indigo-950/55 via-violet-950/25 to-black/75"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(251,113,133,0.18),transparent_48%),radial-gradient(ellipse_at_70%_30%,rgba(56,189,248,0.12),transparent_40%)]"
      />

      <div className="relative z-10 flex w-full max-w-md flex-col items-center px-6">
        <h1
          className="text-center font-[family-name:var(--font-carousel-serif)] text-4xl font-bold tracking-[0.04em] text-amber-100 sm:text-5xl md:text-6xl"
          style={{
            textShadow:
              "0 0 18px rgba(251,191,36,0.55), 0 0 36px rgba(244,114,182,0.35), 0 2px 10px rgba(0,0,0,0.65)",
          }}
        >
          JOIN THE CHAT CAROUSEL
        </h1>

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="mt-10 w-full rounded-[2rem] border border-rose-200/30 bg-white/10 p-8 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:p-10"
        >
          <div className="space-y-6 font-[family-name:var(--font-carousel-sans)]">
            <div className="space-y-2 text-left">
              <label
                htmlFor="carousel-signup-name"
                className="text-sm tracking-wide text-rose-100/90"
              >
                Name
              </label>
              <input
                id="carousel-signup-name"
                name="name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                disabled={isSubmitting}
                className={fieldClassName}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2 text-left">
              <label
                htmlFor="carousel-signup-email"
                className="text-sm tracking-wide text-rose-100/90"
              >
                Email
              </label>
              <input
                id="carousel-signup-email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isSubmitting}
                className={fieldClassName}
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-2 text-left">
              <label
                htmlFor="carousel-signup-password"
                className="text-sm tracking-wide text-rose-100/90"
              >
                Password
              </label>
              <input
                id="carousel-signup-password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isSubmitting}
                className={fieldClassName}
                placeholder="••••••••"
              />
            </div>
          </div>

          {error ? (
            <p
              role="alert"
              className="mt-5 text-sm font-medium text-rose-200"
            >
              {error}
            </p>
          ) : null}
          {info ? (
            <p
              role="status"
              className="mt-5 text-sm font-medium text-amber-100"
            >
              {info}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-red-600 to-red-500 px-8 py-3.5 font-[family-name:var(--font-carousel-serif)] text-lg font-semibold tracking-wide text-amber-100 shadow-[0_0_24px_rgba(220,38,38,0.55)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Signing up…
              </>
            ) : (
              "Sign Up"
            )}
          </button>

          <p className="mt-5 text-center text-sm text-rose-100/75">
            Already riding?{" "}
            <Link
              href="/login"
              className="font-semibold text-amber-100 underline-offset-4 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </form>
      </div>

      <Link
        href="/"
        className="absolute bottom-5 right-5 z-20 flex items-center gap-2 text-rose-100/85 transition hover:text-amber-100 sm:bottom-7 sm:right-8"
        style={{
          textShadow: "0 0 10px rgba(251,191,36,0.35)",
          filter: "drop-shadow(0 0 8px rgba(244,114,182,0.3))",
        }}
      >
        <SpiralMark className="h-7 w-7 text-amber-200" />
        <span className="font-[family-name:var(--font-carousel-serif)] text-sm tracking-wide sm:text-base">
          Chat Carousel
        </span>
      </Link>
    </div>
  );
}

export default CarouselSignUpForm;
