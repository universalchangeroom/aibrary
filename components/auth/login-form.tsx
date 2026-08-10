"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";

type AuthMode = "signin" | "signup";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/feed";

  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setInfo(null);
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

        router.push(nextPath);
        router.refresh();
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
        router.push(nextPath);
        router.refresh();
        return;
      }

      setInfo(
        "Account created. Check your email to confirm your address, then sign in."
      );
      setMode("signin");
      setIsSubmitting(false);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Welcome to ChatShare</CardTitle>
        <CardDescription>
          Sign in or create an account to publish your AI conversations.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as AuthMode);
            setError(null);
            setInfo(null);
          }}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Create Account</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="mt-6">
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

          <TabsContent value="signup" className="mt-6">
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
      </CardContent>
    </Card>
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
        <Label htmlFor={`${mode}-email`}>Email</Label>
        <Input
          id={`${mode}-email`}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => onEmailChange(event.target.value)}
          placeholder="you@example.com"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${mode}-password`}>Password</Label>
        <Input
          id={`${mode}-password`}
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          value={password}
          onChange={(event) => onPasswordChange(event.target.value)}
          placeholder="••••••••"
          minLength={6}
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
