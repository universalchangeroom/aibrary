"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Loader2 } from "lucide-react";

import {
  requestPasswordReset,
  validateAuthEmail,
} from "@/components/auth/forgot-password-panel";
import { createClient } from "@/lib/supabase/client";

type AuthView = "signin" | "forgot";

const pillInputClassName =
  "w-full rounded-full border border-white/35 bg-black/20 px-5 py-3 text-sm text-white placeholder:text-white/40 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-sm transition-all focus:border-pink-400/70 focus:outline-none focus:ring-1 focus:ring-pink-400/50 disabled:cursor-not-allowed disabled:opacity-60";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/feed";

  const [view, setView] = useState<AuthView>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const trimmedEmail = email.trim();

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const validationError = validateAuthEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      await requestPasswordReset(email);
      setInfo("Check your email for the reset link.");
      setIsSubmitting(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not send reset email.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  if (view === "forgot") {
    return (
      <form
        onSubmit={(event) => void handleForgotPassword(event)}
        className="flex w-full max-w-sm flex-col gap-3"
      >
        <label htmlFor="login-forgot-email" className="sr-only">
          Email
        </label>
        <input
          id="login-forgot-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          disabled={isSubmitting}
          required
          className={pillInputClassName}
        />

        {error ? (
          <p role="alert" className="text-center text-sm text-pink-300">
            {error}
          </p>
        ) : null}
        {info ? (
          <p role="status" className="text-center text-sm text-cyan-300">
            {info}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full border border-white/40 bg-white/10 px-5 py-3 text-sm font-bold tracking-wide text-white backdrop-blur-sm transition-all hover:border-pink-400/60 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? (
            <span className="inline-flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Sending…
            </span>
          ) : (
            "Send reset link"
          )}
        </button>

        <button
          type="button"
          className="text-center text-sm text-white/55 transition-colors hover:text-white/90"
          onClick={() => {
            setView("signin");
            setError(null);
            setInfo(null);
          }}
          disabled={isSubmitting}
        >
          Back to log in
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={(event) => void handleSignIn(event)}
      className="flex w-full max-w-sm flex-col gap-3"
    >
      <label htmlFor="login-email" className="sr-only">
        Email
      </label>
      <input
        id="login-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Email"
        disabled={isSubmitting}
        required
        className={pillInputClassName}
      />

      <div className="relative">
        <label htmlFor="login-password" className="sr-only">
          Password
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          minLength={6}
          disabled={isSubmitting}
          required
          className={pillInputClassName}
        />
      </div>

      <div className="flex justify-end px-1">
        <button
          type="button"
          className="text-xs text-white/50 underline-offset-4 transition-colors hover:text-cyan-300 hover:underline"
          onClick={() => {
            setView("forgot");
            setError(null);
            setInfo(null);
          }}
          disabled={isSubmitting}
        >
          Forgot password?
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-center text-sm text-pink-300">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-center text-sm text-cyan-300">
          {info}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full border border-pink-400/50 bg-gradient-to-r from-pink-500/80 via-purple-500/80 to-cyan-400/80 px-5 py-3 text-sm font-bold tracking-wide text-white shadow-[0_0_20px_rgba(139,92,246,0.35)] transition-all hover:scale-[1.02] hover:shadow-[0_0_28px_rgba(236,72,153,0.45)] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
      >
        {isSubmitting ? (
          <span className="inline-flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Logging in…
          </span>
        ) : (
          "Log In"
        )}
      </button>

      <p className="pt-1 text-center text-sm text-white/55">
        No ticket?{" "}
        <Link
          href="/sign-up"
          className="text-cyan-400 hover:text-cyan-300 hover:underline"
        >
          Step right up.
        </Link>
      </p>
    </form>
  );
}
