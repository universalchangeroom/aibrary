"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";

import { updateProfile } from "@/lib/actions/profile";
import {
  BIO_MAX_LENGTH,
  type ProfileFormValues,
} from "@/lib/validations/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface ProfileSettingsFormProps {
  initialValues: ProfileFormValues;
}

export function ProfileSettingsForm({
  initialValues,
}: ProfileSettingsFormProps) {
  const [username, setUsername] = useState(initialValues.username);
  const [displayName, setDisplayName] = useState(initialValues.display_name);
  const [bio, setBio] = useState(initialValues.bio);
  const [error, setError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!showSuccessToast) return;
    const timer = window.setTimeout(() => setShowSuccessToast(false), 2800);
    return () => window.clearTimeout(timer);
  }, [showSuccessToast]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await updateProfile({
        username,
        display_name: displayName,
        bio,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      setUsername(result.profile.username);
      setDisplayName(result.profile.display_name);
      setBio(result.profile.bio);
      setShowSuccessToast(true);
    });
  }

  const bioLength = bio.length;
  const bioOverLimit = bioLength > BIO_MAX_LENGTH;

  return (
    <>
      {showSuccessToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 shadow-md"
        >
          <Check className="h-4 w-4 shrink-0" aria-hidden />
          Profile saved successfully.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Choose how you appear on published threads and your public
            portfolio.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="settings-username">Username</Label>
              <Input
                id="settings-username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="your_handle"
                disabled={isPending}
                aria-describedby="settings-username-hint"
              />
              <p
                id="settings-username-hint"
                className="text-xs text-muted-foreground"
              >
                Lowercase letters, numbers, and underscores only. Used in your
                public profile URL.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="settings-display-name">Display Name</Label>
              <Input
                id="settings-display-name"
                name="display_name"
                autoComplete="nickname"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="How you want to be shown"
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-end justify-between gap-3">
                <Label htmlFor="settings-bio">Bio</Label>
                <span
                  className={cn(
                    "text-xs tabular-nums text-muted-foreground",
                    bioOverLimit && "font-medium text-destructive"
                  )}
                  aria-live="polite"
                >
                  {bioLength}/{BIO_MAX_LENGTH}
                </span>
              </div>
              <Textarea
                id="settings-bio"
                name="bio"
                value={bio}
                onChange={(event) => setBio(event.target.value)}
                placeholder="A short intro for your public portfolio"
                disabled={isPending}
                rows={4}
                maxLength={BIO_MAX_LENGTH + 20}
                aria-invalid={bioOverLimit}
              />
            </div>

            {error ? (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}
          </CardContent>

          <CardFooter className="justify-end border-t bg-muted/20 px-6 py-4">
            <Button type="submit" disabled={isPending || bioOverLimit}>
              {isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save profile"
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </>
  );
}
