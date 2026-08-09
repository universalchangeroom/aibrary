"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, Upload } from "lucide-react";

import { AuthModal } from "@/components/auth/auth-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import type { ImportedMessage } from "@/lib/import-link/types";

interface ImportModalProps {
  triggerLabel?: string;
  triggerClassName?: string;
}

type ImportMode = "link" | "text";

type ParsedPreview = {
  source: string;
  title: string;
  originalUrl: string;
  messages: ImportedMessage[];
  verified?: boolean;
};

/**
 * Normalize both Express parserService and Next.js /api/import-link responses.
 */
function normalizeImportPayload(payload: unknown): ParsedPreview {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected response from import API.");
  }

  const record = payload as Record<string, unknown>;

  // Express / Next envelope: { success, data, error }
  if ("success" in record) {
    if (record.success === false) {
      throw new Error(
        typeof record.error === "string"
          ? record.error
          : "Invalid or unsupported share URL."
      );
    }
    const data = record.data as Record<string, unknown> | undefined;
    if (!data) {
      throw new Error("Import succeeded but no conversation data was returned.");
    }
    return mapThread(data);
  }

  // Next.js error shape: { error, message }
  if (typeof record.error === "string" && !Array.isArray(record.messages)) {
    throw new Error(
      typeof record.message === "string" ? record.message : record.error
    );
  }

  return mapThread(record);
}

function mapThread(data: Record<string, unknown>): ParsedPreview {
  const messages = Array.isArray(data.messages)
    ? (data.messages as ImportedMessage[]).filter(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string"
      )
    : [];

  return {
    source: typeof data.source === "string" ? data.source : "ChatGPT",
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title
        : "Imported Conversation",
    originalUrl: typeof data.originalUrl === "string" ? data.originalUrl : "",
    messages,
    verified: data.verified === true,
  };
}

/**
 * Normalize { success, data: { title, messages } } from /api/parse-text.
 */
function normalizeParseTextPayload(payload: unknown): ParsedPreview {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected response from parse-text API.");
  }

  const record = payload as Record<string, unknown>;

  if (record.success === false) {
    throw new Error(
      typeof record.error === "string"
        ? record.error
        : "Failed to parse conversation text."
    );
  }

  const data =
    record.success === true && record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;

  const messages = Array.isArray(data.messages)
    ? (data.messages as ImportedMessage[]).filter(
        (m) =>
          m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
    : [];

  if (messages.length === 0) {
    throw new Error(
      'Could not detect speaker turns. Use labels like "User:" / "You:" and "ChatGPT:" / "Assistant:".'
    );
  }

  return {
    source: "Pasted Text",
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title
        : "Imported Thread",
    originalUrl: "",
    messages,
    verified: false,
  };
}

export function ImportModal({
  triggerLabel = "Get started free",
  triggerClassName,
}: ImportModalProps) {
  const router = useRouter();
  const { session, isLoading: isAuthLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [mode, setMode] = useState<ImportMode>("link");
  const [url, setUrl] = useState("");
  const [rawText, setRawText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isParsingText, setIsParsingText] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Parsed thread kept in memory across auth so sign-in does not drop the draft. */
  const [result, setResult] = useState<ParsedPreview | null>(null);
  /** After successful auth, automatically resume publish if the user tried while logged out. */
  const publishAfterAuthRef = useRef(false);
  /** Prevents double POST if auth success and session effect both fire. */
  const publishInFlightRef = useRef(false);

  function resetState() {
    setMode("link");
    setUrl("");
    setRawText("");
    setError(null);
    setResult(null);
    setIsLoading(false);
    setIsParsingText(false);
    setIsPublishing(false);
    publishAfterAuthRef.current = false;
    publishInFlightRef.current = false;
  }

  function sourceModelFromResult(preview: ParsedPreview): string {
    if (preview.source === "ChatGPT") return "GPT-4o";
    if (preview.source === "Claude") return "Claude 3.5 Sonnet";
    if (preview.source === "Perplexity") return "Other";
    return preview.source || "Other";
  }

  /**
   * Persist the parsed preview via the authenticated backend endpoint.
   * Pass an access token explicitly when resuming immediately after auth
   * (session from context may lag one tick).
   */
  async function publishThread(accessToken: string, preview: ParsedPreview) {
    if (publishInFlightRef.current) return;
    publishInFlightRef.current = true;
    setError(null);
    setIsPublishing(true);

    try {
      const response = await fetch("/api/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: preview.title || "Imported Thread",
          content: preview.messages,
          source: preview.source,
          source_model: sourceModelFromResult(preview),
          originalUrl: preview.originalUrl,
          tags: [],
          is_public: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        data?: { id?: string };
      };

      if (!response.ok || !payload.success || !payload.data?.id) {
        throw new Error(payload.error || "Failed to publish thread.");
      }

      const threadId = payload.data.id;
      setOpen(false);
      resetState();
      router.push(`/feed/${threadId}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to publish thread."
      );
      setIsPublishing(false);
      publishAfterAuthRef.current = false;
      publishInFlightRef.current = false;
    }
  }

  async function handlePublish() {
    if (!result || result.messages.length === 0) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      // Keep `result` (draft) in state; open auth so user can continue after sign-in.
      publishAfterAuthRef.current = true;
      setAuthOpen(true);
      setError(null);
      return;
    }

    await publishThread(accessToken, result);
  }

  /** After sign-in/up from AuthModal, publish the draft if the user intended to. */
  async function handleAuthSuccess() {
    if (!publishAfterAuthRef.current || !result) return;

    publishAfterAuthRef.current = false;

    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const {
      data: { session: freshSession },
    } = await supabase.auth.getSession();

    const token = freshSession?.access_token ?? session?.access_token;
    if (!token) {
      setError(
        "Signed in, but no access token was available. Try publishing again."
      );
      return;
    }

    await publishThread(token, result);
  }

  // If auth state becomes available while a publish was deferred, resume once.
  useEffect(() => {
    if (
      !publishAfterAuthRef.current ||
      !session?.access_token ||
      !result ||
      isPublishing ||
      authOpen
    ) {
      return;
    }

    const token = session.access_token;
    publishAfterAuthRef.current = false;
    void publishThread(token, result);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resume only when session appears after deferred publish
  }, [session?.access_token, result, isPublishing, authOpen]);

  async function handleImport(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please paste a ChatGPT share URL.");
      return;
    }

    if (!/^https?:\/\/.+/i.test(trimmed)) {
      setError("Invalid URL. Example: https://chatgpt.com/share/…");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const err = payload as { message?: string; error?: string };
        throw new Error(
          err.message || err.error || "Failed to import share link."
        );
      }

      const preview = normalizeImportPayload(payload);
      if (preview.messages.length === 0) {
        throw new Error(
          "Import completed, but no messages were found in this share link."
        );
      }

      setResult(preview);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : "Failed to import share link."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleParseText(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResult(null);

    const pastedText = rawText.trim();
    if (!pastedText) {
      setError("Please paste conversation text before parsing.");
      return;
    }

    setIsParsingText(true);

    try {
      const response = await fetch("/api/parse-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pastedText }),
      });

      const payload: unknown = await response.json();

      if (!response.ok) {
        const err = payload as { error?: string; message?: string };
        throw new Error(
          err.error || err.message || "Failed to parse conversation text."
        );
      }

      const preview = normalizeParseTextPayload(payload);
      setResult(preview);
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : "Failed to parse conversation text."
      );
    } finally {
      setIsParsingText(false);
    }
  }

  const isBusy = isLoading || isParsingText || isPublishing;
  const showTextForm = mode === "text" && !result && !isParsingText;
  const showLinkForm = mode === "link" && !result;

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Only wipe draft when fully closing; keep state if auth modal took focus mid-flow.
        if (!next && !publishAfterAuthRef.current) {
          resetState();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button size="lg" className={triggerClassName}>
          {triggerLabel}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Import a conversation</DialogTitle>
          <DialogDescription>
            Paste a public share link, or paste conversation text copied from
            ChatGPT or Claude.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <Tabs
            value={mode}
            onValueChange={(value) => {
              setMode(value as ImportMode);
              setError(null);
              setResult(null);
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="link" disabled={isBusy}>
                Paste Link
              </TabsTrigger>
              <TabsTrigger value="text" disabled={isBusy}>
                Paste Text
              </TabsTrigger>
            </TabsList>

            {showLinkForm ? (
              <TabsContent value="link" className="mt-4 space-y-4">
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-import-url">ChatGPT share URL</Label>
                    <Input
                      id="home-import-url"
                      type="url"
                      value={url}
                      onChange={(event) => {
                        setUrl(event.target.value);
                        setError(null);
                      }}
                      placeholder="https://chatgpt.com/share/…"
                      disabled={isLoading}
                      autoComplete="off"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full sm:w-auto"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Importing…
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4" />
                        Import Thread
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            ) : null}

            {showTextForm ? (
              <TabsContent value="text" className="mt-4 space-y-4">
                <form onSubmit={handleParseText} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-import-text">Conversation text</Label>
                    <Textarea
                      id="home-import-text"
                      value={rawText}
                      onChange={(event) => {
                        setRawText(event.target.value);
                        setError(null);
                      }}
                      placeholder="Paste conversation text here (e.g. copied directly from ChatGPT or Claude)..."
                      disabled={isParsingText}
                      className="min-h-[160px] max-h-[50vh] resize-y font-mono text-sm"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isParsingText}
                    className="w-full sm:w-auto"
                  >
                    {isParsingText ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Parsing…
                      </>
                    ) : (
                      <>
                        <FileText className="h-4 w-4" />
                        Parse Text
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            ) : null}

            {/* Keep tab content mounted while loading text mode without the textarea */}
            {mode === "text" && isParsingText ? (
              <TabsContent value="text" className="mt-4">
                <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Parsing conversation text…
                </div>
              </TabsContent>
            ) : null}
          </Tabs>
        ) : null}

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Fetching and parsing share link…
          </div>
        ) : null}

        {result && !isLoading && !isParsingText ? (
          <div className="space-y-4">
            <div className="space-y-4 rounded-lg border p-4">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{result.source}</Badge>
                  {result.verified ? (
                    <Badge variant="outline">Verified</Badge>
                  ) : null}
                  <span className="text-xs text-muted-foreground">
                    {result.messages.length} messages
                  </span>
                </div>
                <h3 className="text-lg font-semibold leading-snug">
                  {result.title}
                </h3>
                {result.originalUrl ? (
                  <p className="break-all text-xs text-muted-foreground">
                    {result.originalUrl}
                  </p>
                ) : null}
              </div>

              <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
                {result.messages.map((message, index) => (
                  <li
                    key={`${message.role}-${index}`}
                    className="rounded-md border bg-muted/40 p-3 text-left"
                  >
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {message.role === "user" ? "User" : "AI"}
                    </p>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing || isAuthLoading}
              >
                {isPublishing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    {session ? "Publish Thread" : "Sign in & Publish"}
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isPublishing}
                onClick={() => {
                  setResult(null);
                  setError(null);
                  publishAfterAuthRef.current = false;
                }}
              >
                Back to edit
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>

    <AuthModal
      open={authOpen}
      onOpenChange={(next) => {
        setAuthOpen(next);
        if (!next && !session) {
          // User dismissed auth without signing in — drop pending publish flag only.
          publishAfterAuthRef.current = false;
        }
      }}
      redirectTo={null}
      onSuccess={() => {
        void handleAuthSuccess();
      }}
    />
    </>
  );
}
