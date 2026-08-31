"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ExternalLink,
  Loader2,
  MessageSquarePlus,
  Upload,
} from "lucide-react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
import { SUPPORTED_URL_REGEX } from "@/lib/import-link/validate";
import type { ImportedMessage, ImportedThread } from "@/lib/import-link/types";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const PRESET_TAGS = [
  { id: "philosophy", label: "#Philosophy" },
  { id: "coding", label: "#Coding" },
  { id: "mythbusting", label: "#MythBusting" },
] as const;

const SOURCE_MODEL_MAP: Record<ImportedThread["source"], string> = {
  ChatGPT: "GPT-4o",
  Claude: "Claude 3.5 Sonnet",
  DeepSeek: "DeepSeek",
  Perplexity: "Other",
};

type Turn = {
  user: ImportedMessage;
  assistant?: ImportedMessage;
};

function isValidShareLink(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return SUPPORTED_URL_REGEX.test(trimmed);
}

function pairMessages(messages: ImportedMessage[]): Turn[] {
  const turns: Turn[] = [];
  let pendingUser: ImportedMessage | null = null;

  for (const message of messages) {
    if (message.role === "user") {
      if (pendingUser) {
        turns.push({ user: pendingUser });
      }
      pendingUser = message;
      continue;
    }

    if (pendingUser) {
      turns.push({ user: pendingUser, assistant: message });
      pendingUser = null;
    } else {
      turns.push({
        user: { role: "user", content: "(No user prompt captured)" },
        assistant: message,
      });
    }
  }

  if (pendingUser) {
    turns.push({ user: pendingUser });
  }

  return turns;
}

function MessageBody({ content }: { content: string }) {
  return (
    <div className="space-y-3 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
      {content.split(/(```[\s\S]*?```)/g).map((chunk, index) => {
        if (chunk.startsWith("```") && chunk.endsWith("```")) {
          const inner = chunk.slice(3, -3);
          const newline = inner.indexOf("\n");
          const language =
            newline === -1 ? "" : inner.slice(0, newline).trim();
          const code = newline === -1 ? inner : inner.slice(newline + 1);

          return (
            <div
              key={index}
              className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
            >
              {language ? (
                <div className="border-b border-zinc-800 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wide text-zinc-400">
                  {language}
                </div>
              ) : null}
              <pre className="overflow-x-auto p-4 text-[13px] leading-6 text-zinc-100">
                <code>{code.replace(/\n$/, "")}</code>
              </pre>
            </div>
          );
        }

        if (!chunk.trim()) return null;
        return <p key={index}>{chunk.trim()}</p>;
      })}
    </div>
  );
}

export function ImportThread() {
  const router = useRouter();
  const lastImportedUrl = useRef<string | null>(null);

  const [url, setUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [imported, setImported] = useState<ImportedThread | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const importShareLink = useCallback(async (rawUrl: string) => {
    const trimmed = rawUrl.trim();
    if (!isValidShareLink(trimmed)) {
      setImportError(
        "Paste a valid ChatGPT, Claude, or Perplexity share link."
      );
      return;
    }

    if (lastImportedUrl.current === trimmed) {
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setPublishError(null);
    setImported(null);

    try {
      const response = await fetch("/api/import-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const payload = (await response.json()) as ImportedThread & {
        error?: string;
        message?: string;
      };

      if (!response.ok) {
        throw new Error(
          payload.message || payload.error || "Failed to import share link."
        );
      }

      lastImportedUrl.current = trimmed;
      setImported(payload);
    } catch (error) {
      lastImportedUrl.current = null;
      setImported(null);
      setImportError(
        error instanceof Error ? error.message : "Failed to import share link."
      );
    } finally {
      setIsImporting(false);
    }
  }, []);

  // Auto-detect a valid share URL already on the clipboard when the tab is focused.
  useEffect(() => {
    async function tryClipboardAutoPaste() {
      if (typeof navigator === "undefined" || !navigator.clipboard?.readText) {
        return;
      }

      try {
        const text = (await navigator.clipboard.readText()).trim();
        if (!isValidShareLink(text)) return;
        if (text === lastImportedUrl.current) return;

        setUrl(text);
        void importShareLink(text);
      } catch {
        // Clipboard permission denied — ignore; paste handler still works.
      }
    }

    const onFocus = () => {
      void tryClipboardAutoPaste();
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void tryClipboardAutoPaste();
      }
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [importShareLink]);

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").trim();
    if (!isValidShareLink(pasted)) return;

    event.preventDefault();
    setUrl(pasted);
    void importShareLink(pasted);
  }

  function handleUrlChange(value: string) {
    setUrl(value);
    setImportError(null);

    if (isValidShareLink(value) && value.trim() !== lastImportedUrl.current) {
      void importShareLink(value);
    }
  }

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag]
    );
  }

  async function handlePublish(event: FormEvent) {
    event.preventDefault();
    if (!imported) return;

    setPublishError(null);
    setIsPublishing(true);

    try {
      const supabase = createClient();
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError) throw authError;
      const accessToken = session?.access_token;
      if (!accessToken || !session.user) {
        setPublishError("You must be signed in to publish.");
        setIsPublishing(false);
        return;
      }

      const response = await fetch("/api/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: imported.title || `${imported.source} Conversation`,
          source_model: SOURCE_MODEL_MAP[imported.source],
          source: imported.source,
          tags: selectedTags,
          content: imported.messages,
          is_public: true,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: { id?: string; status?: string };
      };

      if (!response.ok || !payload.success || !payload.data?.id) {
        throw new Error(payload.error || "Failed to publish thread.");
      }

      if (
        payload.data.status === "pending_review" ||
        (typeof payload.message === "string" && payload.message)
      ) {
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            "chatshare_publish_notice",
            payload.message ||
              "Your thread contains image content and has been submitted for admin review before appearing on the public feed."
          );
        }
      }

      router.push(`/feed/${payload.data.id}`);
      router.refresh();
    } catch (error) {
      setPublishError(
        error instanceof Error ? error.message : "Failed to publish thread."
      );
      setIsPublishing(false);
    }
  }

  const turns = imported ? pairMessages(imported.messages) : [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-xl">Import Thread</CardTitle>
          <CardDescription>
            Open a chat, copy the public share link, and paste it here. We
            fetch and format the conversation for publishing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a
                href="https://chatgpt.com"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open ChatGPT
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
            <Button asChild variant="outline" size="sm">
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Claude
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </Button>
          </div>

          <div className="space-y-2">
            <Label htmlFor="import-url">Share link</Label>
            <div className="relative">
              <Input
                id="import-url"
                type="url"
                value={url}
                onChange={(event) => handleUrlChange(event.target.value)}
                onPaste={handlePaste}
                placeholder="https://chatgpt.com/share/… or https://claude.ai/share/…"
                className="pr-10"
                disabled={isImporting}
                autoComplete="off"
              />
              {isImporting ? (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              Paste a ChatGPT, Claude, or Perplexity share URL — import starts
              automatically.
            </p>
          </div>

          {importError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {importError}
            </p>
          ) : null}

          {isImporting ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed px-4 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Importing conversation…
            </div>
          ) : null}
        </CardContent>
      </Card>

      {imported ? (
        <form onSubmit={handlePublish} className="space-y-6">
          <Card>
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{imported.source}</Badge>
                <span className="text-xs text-muted-foreground">
                  {imported.messages.length} messages
                </span>
              </div>
              <CardTitle className="text-lg leading-snug">
                {imported.title}
              </CardTitle>
              <CardDescription className="break-all text-xs">
                {imported.originalUrl}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {turns.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No conversation turns were found in this import.
                </p>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {turns.map((turn, index) => (
                    <AccordionItem key={index} value={`turn-${index}`}>
                      <AccordionTrigger className="text-left hover:no-underline">
                        <span className="flex items-start gap-2 pr-2">
                          <MessageSquarePlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span className="line-clamp-2 font-medium">
                            {turn.user.content}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        {turn.assistant ? (
                          <MessageBody content={turn.assistant.content} />
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No assistant reply for this prompt.
                          </p>
                        )}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </CardContent>
          </Card>

          <div className="space-y-3">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2">
              {PRESET_TAGS.map((tag) => {
                const active = selectedTags.includes(tag.label);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleTag(tag.label)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors",
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background text-foreground hover:bg-accent"
                    )}
                    aria-pressed={active}
                  >
                    {active ? <Check className="h-3.5 w-3.5" /> : null}
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {publishError ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {publishError}
            </p>
          ) : null}

          <Button type="submit" disabled={isPublishing} className="w-full sm:w-auto">
            {isPublishing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                Publish to Feed
              </>
            )}
          </Button>
        </form>
      ) : null}
    </div>
  );
}
