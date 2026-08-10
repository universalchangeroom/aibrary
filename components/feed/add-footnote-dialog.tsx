"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageSquarePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";

interface AddFootnoteDialogProps {
  threadId: string;
}

export function AddFootnoteDialog({ threadId }: AddFootnoteDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quotedText, setQuotedText] = useState("");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetForm() {
    setQuotedText("");
    setBody("");
    setSourceUrl("");
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedQuote = quotedText.trim();
    const trimmedBody = body.trim();
    const trimmedSource = sourceUrl.trim();

    if (!trimmedQuote) {
      setError("Please include the quoted text you are annotating.");
      return;
    }

    if (!trimmedBody) {
      setError("Please add a correction or context note.");
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) {
        throw authError;
      }

      if (!user) {
        setError("You must be signed in to add a footnote.");
        setIsSubmitting(false);
        return;
      }

      const { error: insertError } = await supabase.from("footnotes").insert({
        thread_id: threadId,
        author_id: user.id,
        quoted_text: trimmedQuote,
        body: trimmedBody,
        source_url: trimmedSource || null,
      });

      if (insertError) {
        throw insertError;
      }

      resetForm();
      setOpen(false);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit footnote.";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <MessageSquarePlus className="h-4 w-4" />
          Add Context / Footnote
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a community footnote</DialogTitle>
          <DialogDescription>
            Annotate a claim from this conversation with context, a correction,
            or a supporting source.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quoted-text">Quoted Text</Label>
            <Textarea
              id="quoted-text"
              value={quotedText}
              onChange={(event) => setQuotedText(event.target.value)}
              placeholder="Paste the exact claim from the AI you are disputing or annotating."
              className="min-h-[96px]"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="correction">Correction / Context</Label>
            <Textarea
              id="correction"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Explain the issue, add missing context, or provide the corrected information."
              className="min-h-[120px]"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="source-url">Source URL</Label>
            <Input
              id="source-url"
              type="url"
              value={sourceUrl}
              onChange={(event) => setSourceUrl(event.target.value)}
              placeholder="https://docs.example.com/proof (optional)"
              disabled={isSubmitting}
            />
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Submitting…
                </>
              ) : (
                "Submit Footnote"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
