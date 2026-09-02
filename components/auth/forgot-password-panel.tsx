"use client";

import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

interface ForgotPasswordPanelProps {
  email: string;
  error: string | null;
  info: string | null;
  isSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function validateAuthEmail(email: string): string | null {
  if (!email.trim()) return "Please enter your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return "Please enter a valid email address.";
  }
  return null;
}

export async function requestPasswordReset(email: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

export function ForgotPasswordPanel({
  email,
  error,
  info,
  isSubmitting,
  onEmailChange,
  onSubmit,
  onBack,
}: ForgotPasswordPanelProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="forgot-password-email">Email</Label>
        <Input
          id="forgot-password-email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
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

      <Button
        type="button"
        className="w-full"
        disabled={isSubmitting}
        onClick={onSubmit}
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending reset link…
          </>
        ) : (
          "Send reset link"
        )}
      </Button>

      <Button
        type="button"
        variant="ghost"
        className="w-full text-muted-foreground"
        disabled={isSubmitting}
        onClick={onBack}
      >
        Back to sign in
      </Button>
    </div>
  );
}
