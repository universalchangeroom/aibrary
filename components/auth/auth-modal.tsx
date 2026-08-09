"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

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
  if (!email.trim()) {
    return "Please enter your email address.";
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please enter a valid email address.";
  }
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
  const [mode, setMode] = useState<AuthMode>(defaultMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setEmail("");
    setPassword("");
    setError(null);
    setInfo(null);
    setIsSubmitting(false);
    setMode(defaultMode);
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
      if (mode === "signin") {
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
      setMode("signin");
      setIsSubmitting(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      // Supabase often returns "Invalid login credentials"
      setError(message);
      setIsSubmitting(false);
    }
  }

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
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </DialogTitle>
          <DialogDescription>
            {mode === "signin"
              ? "Sign in with your email and password to publish threads and vote."
              : "Sign up to share AI conversations and annotate the feed."}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as AuthMode);
            setError(null);
            setInfo(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin" disabled={isSubmitting}>
              Sign In
            </TabsTrigger>
            <TabsTrigger value="signup" disabled={isSubmitting}>
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-4">
            <AuthFields
              mode="signin"
              email={email}
              password={password}
              error={error}
              info={info}
              isSubmitting={isSubmitting}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
            />
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <AuthFields
              mode="signup"
              email={email}
              password={password}
              error={error}
              info={info}
              isSubmitting={isSubmitting}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onSubmit={handleSubmit}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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
        <Label htmlFor={`auth-modal-${mode}-password`}>Password</Label>
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
