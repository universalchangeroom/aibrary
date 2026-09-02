"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  ForgotPasswordPanel,
  requestPasswordReset,
  validateAuthEmail,
} from "@/components/auth/forgot-password-panel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";
type AuthView = AuthMode | "forgot";
type OAuthProvider = "google" | "github";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Where to send the user after a successful auth.
   * Pass `null` to skip navigation (e.g. resume an in-progress publish flow).
   * Defaults to /feed.
   */
  redirectTo?: string | null;
  defaultMode?: AuthMode;
  /** Called after a successful sign-in / sign-up with a session. */
  onSuccess?: () => void;
}

function validateCredentials(email: string, password: string): string | null {
  const emailError = validateAuthEmail(email);
  if (emailError) return emailError;
  if (!password) {
    return "Please enter your password.";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

export function AuthModal({
  open,
  onOpenChange,
  redirectTo = "/feed",
  defaultMode = "signin",
  onSuccess,
}: AuthModalProps) {
  const router = useRouter();
  const [view, setView] = useState<AuthView>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthProvider, setOauthProvider] = useState<OAuthProvider | null>(
    null
  );

  const isBusy = isSubmitting || oauthProvider !== null;

  function resetForm() {
    setEmail("");
    setPassword("");
    setError(null);
    setInfo(null);
    setIsSubmitting(false);
    setOauthProvider(null);
    setView(defaultMode);
  }

  function finishSuccessfully() {
    onOpenChange(false);
    resetForm();
    onSuccess?.();
    if (redirectTo) {
      router.push(redirectTo);
      router.refresh();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);

    const validationError = validateCredentials(email, password);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();
    const trimmedEmail = email.trim();

    try {
      if (view === "signin") {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });

        if (signInError) {
          throw signInError;
        }

        finishSuccessfully();
        return;
      }

      const { data, error: signUpError } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
      });

      if (signUpError) {
        throw signUpError;
      }

      if (data.session) {
        finishSuccessfully();
        return;
      }

      setInfo("Check your email for a confirmation link, then sign in.");
      setView("signin");
      setIsSubmitting(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  async function handleForgotPassword() {
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

  async function handleOAuthSignIn(provider: OAuthProvider) {
    setError(null);
    setInfo(null);
    setOauthProvider(provider);

    const supabase = createClient();

    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/feed`,
        },
      });

      if (oauthError) {
        throw oauthError;
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Could not start social sign-in.";
      setError(message);
      setOauthProvider(null);
    }
  }

  const mode = view === "forgot" ? "signin" : view;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          resetForm();
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {view === "forgot"
              ? "Reset your password"
              : mode === "signin"
                ? "Welcome back"
                : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            {view === "forgot"
              ? "Enter your email and we will send you a link to choose a new password."
              : mode === "signin"
                ? "Sign in with your email and password to publish threads and vote."
                : "Sign up to share AI conversations and annotate the feed."}
          </DialogDescription>
        </DialogHeader>

        {view === "forgot" ? (
          <ForgotPasswordPanel
            email={email}
            error={error}
            info={info}
            isSubmitting={isSubmitting}
            onEmailChange={setEmail}
            onSubmit={() => void handleForgotPassword()}
            onBack={() => {
              setView("signin");
              setError(null);
              setInfo(null);
            }}
          />
        ) : (
          <div className="space-y-4">
            <OAuthSignInButtons
              oauthProvider={oauthProvider}
              disabled={isBusy}
              onSignIn={handleOAuthSignIn}
            />

            {error ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            <AuthEmailDivider />

            <Tabs
              value={mode}
              onValueChange={(value) => {
                setView(value as AuthMode);
                setError(null);
                setInfo(null);
              }}
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" disabled={isBusy}>
                  Sign In
                </TabsTrigger>
                <TabsTrigger value="signup" disabled={isBusy}>
                  Sign Up
                </TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <AuthFields
                  mode="signin"
                  email={email}
                  password={password}
                  error={null}
                  info={info}
                  isSubmitting={isSubmitting}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={handleSubmit}
                  onForgotPassword={() => {
                    setView("forgot");
                    setError(null);
                    setInfo(null);
                  }}
                />
              </TabsContent>

              <TabsContent value="signup" className="mt-4">
                <AuthFields
                  mode="signup"
                  email={email}
                  password={password}
                  error={null}
                  info={info}
                  isSubmitting={isSubmitting}
                  onEmailChange={setEmail}
                  onPasswordChange={setPassword}
                  onSubmit={handleSubmit}
                />
              </TabsContent>
            </Tabs>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.41-.66 0-1.35.615-1.35 1.38 0 1.005.675 1.545 1.23 2.1.63.63 1.23 1.305 1.23 2.655 0 1.935-1.17 3.315-3.3 3.315-2.31 0-3.75-1.725-3.75-4.125 0-2.25 1.605-3.495 1.605-3.495S4.8 7.68 4.8 6.45c0-1.38.81-2.55 2.1-2.55 1.23 0 1.83.945 1.83.945s1.23-3.9 4.485-3.9c1.32 0 2.475.48 3.255 1.26 1.02-.195 2.1-.72 2.595-1.365-.345-1.02-1.26-1.575-2.25-1.575-1.725 0-3.075 1.155-3.675 2.73-.6-1.575-1.95-2.73-3.675-2.73-1.74 0-3.09 1.155-3.69 2.73C6.09 4.605 4.74 3.45 3.015 3.45c-.99 0-1.905.555-2.25 1.575.495.645 1.575 1.17 2.595 1.365.78-.78 1.935-1.26 3.255-1.26 3.265 0 4.485 3.9 4.485 3.9s1.83-.945 1.83-.945c1.29 0 2.1 1.17 2.1 2.55 0 1.23-1.605 2.475-1.605 2.475s1.605 1.245 1.605 3.495c0 2.4-1.44 4.125-3.75 4.125-2.13 0-3.3-1.38-3.3-3.315 0-1.35.6-2.025 1.23-2.655.555-.555 1.23-1.095 1.23-2.1 0-.765-.69-1.38-1.35-1.38-.51 0-1.095 1.065-1.23 1.41-.24.675-1.02 1.965-4.035 1.41 0 1.005-.015 1.95-.015 2.235 0 .315.225.675.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function OAuthSignInButtons({
  oauthProvider,
  disabled,
  onSignIn,
}: {
  oauthProvider: OAuthProvider | null;
  disabled: boolean;
  onSignIn: (provider: OAuthProvider) => void;
}) {
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="outline"
        className="w-full bg-background hover:bg-muted"
        disabled={disabled}
        onClick={() => onSignIn("google")}
      >
        {oauthProvider === "google" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GoogleIcon className="h-4 w-4" />
        )}
        Continue with Google
      </Button>

      <Button
        type="button"
        variant="outline"
        className="w-full bg-background hover:bg-muted"
        disabled={disabled}
        onClick={() => onSignIn("github")}
      >
        {oauthProvider === "github" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <GitHubIcon className="h-4 w-4" />
        )}
        Continue with GitHub
      </Button>
    </div>
  );
}

function AuthEmailDivider() {
  return (
    <div className="relative">
      <div className="absolute inset-0 flex items-center" aria-hidden>
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-background px-2 text-muted-foreground">
          or continue with email
        </span>
      </div>
    </div>
  );
}

interface AuthFieldsProps {
  mode: AuthMode;
  email: string;
  password: string;
  error: string | null;
  info: string | null;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onForgotPassword?: () => void;
}

function AuthFields({
  mode,
  email,
  password,
  error,
  info,
  isSubmitting,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onForgotPassword,
}: AuthFieldsProps) {
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor={`auth-modal-${mode}-email`}>Email</Label>
        <Input
          id={`auth-modal-${mode}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
          disabled={isSubmitting}
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor={`auth-modal-${mode}-password`}>Password</Label>
          {mode === "signin" && onForgotPassword ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              onClick={onForgotPassword}
              disabled={isSubmitting}
            >
              Forgot password?
            </button>
          ) : null}
        </div>
        <Input
          id={`auth-modal-${mode}-password`}
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="••••••••"
          minLength={6}
          disabled={isSubmitting}
          required
        />
      </div>

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {info ? (
        <p className="rounded-md border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          {info}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            {mode === "signin" ? "Signing in…" : "Creating account…"}
          </>
        ) : mode === "signin" ? (
          "Sign In"
        ) : (
          "Create Account"
        )}
      </Button>
    </form>
  );
}
