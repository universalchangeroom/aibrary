"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ClipboardPaste, Loader2, Sparkles, Upload } from "lucide-react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/rich-text-editor";
import { AuthModal } from "@/components/auth/auth-modal";
import { BookmarkletCard } from "@/components/import/bookmarklet-card";
import {
  ScreenshotImportPanel,
  type ScreenshotParsedPreview,
} from "@/components/import/screenshot-import-panel";
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
import { useAuth } from "@/hooks/use-auth";
import {
  CHATSHARE_PENDING_HASH_KEY,
  CHATSHARE_PENDING_IMPORT_KEY,
} from "@/lib/bookmarklet";
import type { ImportedMessage } from "@/lib/import-link/types";
import { messagesToLabeledTranscript } from "@/lib/messages-to-transcript";
import { parseTags } from "@/lib/parse-transcript";
import { parseRawText } from "@/lib/parse-raw-text";
import { resolveShareSourceModel } from "@/lib/share-source-model";
import { suggestTags } from "@/lib/suggest-tags";
import { cn } from "@/lib/utils";

interface ImportModalProps {
  triggerLabel?: string;
  triggerClassName?: string;
}

type ImportMode = "link" | "text" | "screenshot";

const IMPORT_TAB_LIST_CLASS =
  "flex h-auto min-h-10 w-full flex-wrap items-stretch gap-1 bg-muted p-1 [&>button]:h-auto [&>button]:min-w-[5.5rem] [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs sm:[&>button]:text-sm";

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
      'Could not detect speaker turns. Use labels like "User:" / "You:" and "DeepSeek:" / "ChatGPT:" / "Assistant:" / "Thought process:".'
    );
  }

  const source =
    typeof data.source === "string" && data.source.trim()
      ? data.source
      : "Pasted Text";
  const defaultTitle =
    source === "DeepSeek"
      ? "Imported DeepSeek Thread"
      : source === "Gemini"
        ? "Imported Gemini Thread"
        : source === "Claude"
          ? "Imported Claude Thread"
          : "Imported Thread";

  return {
    source,
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title
        : defaultTitle,
    originalUrl:
      typeof data.originalUrl === "string" ? data.originalUrl : "",
    messages,
    verified: false,
  };
}

/** Accepted public share links for the Paste Link import flow. */
const SUPPORTED_SHARE_URL =
  /^https?:\/\/(?:(?:www\.)?(?:chatgpt\.com|chat\.openai\.com)\/share\/|(?:www\.)?chat\.deepseek\.com\/share\/)[a-zA-Z0-9._-]+\/?$/i;

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
  const [isParsingScreenshot, setIsParsingScreenshot] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Parsed thread kept in memory across auth so sign-in does not drop the draft. */
  const [result, setResult] = useState<ParsedPreview | null>(null);
  /** After successful auth, automatically resume publish if the user tried while logged out. */
  const publishAfterAuthRef = useRef(false);
  /** Prevents double POST if auth success and session effect both fire. */
  const publishInFlightRef = useRef(false);
  const pendingImportHandledRef = useRef(false);
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [showPasteHint, setShowPasteHint] = useState(false);
  const [pasteSourceLabel, setPasteSourceLabel] = useState("Gemini");
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);
  const [isReadingClipboard, setIsReadingClipboard] = useState(false);
  const [tagsInput, setTagsInput] = useState("");
  /** Keywords from the last click of “Suggest Tags” (not live auto-run). */
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);

  /** Live parse of the Paste Text transcript (client-side parseRawText). */
  const parsedConversation = useMemo(() => {
    try {
      return parseRawText(rawText);
    } catch {
      return {
        source: "Pasted Text",
        title: "Imported Thread",
        messages: [] as Array<{ role: "user" | "assistant"; content: string }>,
      };
    }
  }, [rawText]);

  const livePreviewMessages = useMemo(
    () =>
      (parsedConversation.messages ?? []).filter(
        (m) =>
          m &&
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      ),
    [parsedConversation.messages]
  );

  const livePreview: ParsedPreview | null =
    livePreviewMessages.length > 0
      ? {
          source: parsedConversation.source || "Pasted Text",
          title: parsedConversation.title || "Imported Thread",
          originalUrl: "",
          messages: livePreviewMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          verified: false,
        }
      : null;

  const appliedTagSet = useMemo(() => {
    return new Set(parseTags(tagsInput).map((tag) => tag.toLowerCase()));
  }, [tagsInput]);

  const visibleSuggestedTags = useMemo(
    () =>
      suggestedTags.filter((tag) => !appliedTagSet.has(tag.toLowerCase())),
    [suggestedTags, appliedTagSet]
  );

  function handleSuggestTags() {
    const next = suggestTags(rawText, 5);
    setSuggestedTags(next);
  }

  function appendSuggestedTag(tag: string) {
    setTagsInput((prev) => {
      const existing = parseTags(prev);
      if (existing.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        return prev;
      }
      const trimmed = prev.trim();
      if (!trimmed) return tag;
      if (trimmed.endsWith(",")) return `${trimmed} ${tag}`;
      return `${trimmed}, ${tag}`;
    });
    // Hide chip immediately (also covered by appliedTagSet filter).
    setSuggestedTags((prev) =>
      prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
    );
  }

  function resetState() {
    setMode("link");
    setUrl("");
    setRawText("");
    setTagsInput("");
    setSuggestedTags([]);
    setError(null);
    setClipboardNotice(null);
    setResult(null);
    setIsLoading(false);
    setIsParsingText(false);
    setIsParsingScreenshot(false);
    setIsPublishing(false);
    publishAfterAuthRef.current = false;
    publishInFlightRef.current = false;
  }

  /**
   * Restore a thread preview queued by the bookmarklet
   * (localStorage and/or ?import=true + hash handoff).
   */
  useEffect(() => {
    if (typeof window === "undefined" || pendingImportHandledRef.current) {
      return;
    }

    try {
      // Cross-origin handoff: bookmarklet opens ChatShare with #chatshare_pending=...
      const { hash } = window.location;
      const hashPrefix = `#${CHATSHARE_PENDING_HASH_KEY}=`;
      if (hash.startsWith(hashPrefix)) {
        const encoded = hash.slice(hashPrefix.length);
        const decoded = decodeURIComponent(encoded);
        // Validate JSON before persisting
        JSON.parse(decoded);
        localStorage.setItem(CHATSHARE_PENDING_IMPORT_KEY, decoded);
        // Strip hash while keeping ?import=true when present
        window.history.replaceState(
          null,
          "",
          window.location.pathname + window.location.search
        );
      }

      const params = new URLSearchParams(window.location.search);
      const importFlag = params.get("import") === "true";
      const raw = localStorage.getItem(CHATSHARE_PENDING_IMPORT_KEY);

      if (!raw && !importFlag) {
        return;
      }

      pendingImportHandledRef.current = true;

      if (!raw) {
        setOpen(true);
        setError(
          "No pending import found. Run the ChatShare bookmarklet on a chat tab first."
        );
        // Drop empty ?import=true from the URL
        if (importFlag) {
          params.delete("import");
          const q = params.toString();
          window.history.replaceState(
            null,
            "",
            window.location.pathname + (q ? `?${q}` : "")
          );
        }
        return;
      }

      const data = JSON.parse(raw) as Record<string, unknown>;
      const preview = normalizeParseTextPayload({ success: true, data });
      const transcript = messagesToLabeledTranscript(
        preview.messages,
        preview.source
      );
      localStorage.removeItem(CHATSHARE_PENDING_IMPORT_KEY);
      setRawText(transcript);
      setMode("text");
      setResult(null);
      setOpen(true);
      setError(null);

      if (importFlag) {
        params.delete("import");
        const q = params.toString();
        window.history.replaceState(
          null,
          "",
          window.location.pathname + (q ? `?${q}` : "")
        );
      }
    } catch {
      pendingImportHandledRef.current = true;
      try {
        localStorage.removeItem(CHATSHARE_PENDING_IMPORT_KEY);
      } catch {
        // ignore
      }
      setOpen(true);
      setError(
        "Could not restore the bookmarklet import. Try Paste Text instead."
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only pending import hydrate
  }, []);

  // Bookmarklet clipboard handoff: show paste tip on Paste Text (or when URL/session flags it).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      const fromUrl = params.get("paste") === "1";
      const fromSession =
        sessionStorage.getItem("chatshare_expect_paste") === "1";
      if (fromUrl || fromSession) {
        const src =
          params.get("source") ||
          sessionStorage.getItem("chatshare_paste_source") ||
          "AI";
        setPasteSourceLabel(src);
        const model = params.get("model");
        if (model) {
          try {
            sessionStorage.setItem("chatshare_paste_model", model);
          } catch {
            // ignore
          }
        }
        if (src) {
          try {
            sessionStorage.setItem("chatshare_paste_source", src);
          } catch {
            // ignore
          }
        }
        if (fromUrl || mode === "text") {
          setShowPasteHint(true);
        }
        if (fromUrl) {
          setMode("text");
        }
      }
    } catch {
      // ignore storage errors
    }
  }, [mode]);

  useEffect(() => {
    if (!clipboardNotice) return;
    const timer = window.setTimeout(() => setClipboardNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [clipboardNotice]);

  function sourceModelFromResult(preview: ParsedPreview): string {
    return resolveShareSourceModel(preview.source) || "Other";
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
          tags: parseTags(tagsInput),
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

      const threadId = payload.data.id;
      const pending =
        payload.data.status === "pending_review" ||
        (typeof payload.message === "string" && payload.message.length > 0);

      if (pending && typeof window !== "undefined") {
        const notice =
          payload.message ||
          "Your thread contains image content and has been submitted for admin review before appearing on the public feed.";
        window.sessionStorage.setItem("chatshare_publish_notice", notice);
      }

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

  async function handlePasteConversation() {
    if (isReadingClipboard) return;
    setClipboardNotice(null);
    setIsReadingClipboard(true);
    try {
      const text = await navigator.clipboard.readText();
      // Same path as TipTap onChange after a manual Ctrl+V paste.
      setRawText(text);
      setError(null);
      if (text.trim()) {
        setShowPasteHint(false);
      }
    } catch {
      setClipboardNotice(
        "Clipboard access denied. Please press Ctrl+V to paste manually."
      );
    } finally {
      setIsReadingClipboard(false);
    }
  }

  async function handlePublish() {
    // Flush TipTap so we don't publish a stale empty React snapshot.
    const markdown =
      editorRef.current?.getMarkdown()?.trim() || rawText.trim();
    if (markdown && markdown !== rawText) {
      setRawText(markdown);
    }

    let preview = result;
    if (!preview && mode === "text") {
      const parsed = parseRawText(markdown);
      const messages = (parsed.messages ?? []).filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      );
      if (messages.length > 0) {
        preview = {
          source: parsed.source || "Pasted Text",
          title: parsed.title || "Imported Thread",
          originalUrl: "",
          messages: messages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          verified: false,
        };
        setResult(preview);
      }
    }

    if (mode === "screenshot" && preview) {
      const parsed = parseRawText(markdown);
      const messages = (parsed.messages ?? []).filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      );
      preview = {
        ...preview,
        messages:
          messages.length > 0
            ? messages.map((m) => ({ role: m.role, content: m.content }))
            : preview.messages,
      };
      setResult(preview);
    }

    preview =
      preview ??
      (mode === "text"
        ? livePreview
        : mode === "screenshot"
          ? result
          : null);
    if (!preview || preview.messages.length === 0) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      if (!result && (livePreview || preview)) {
        setResult(livePreview ?? preview);
      }
      publishAfterAuthRef.current = true;
      setAuthOpen(true);
      setError(null);
      return;
    }

    await publishThread(accessToken, preview);
  }

  /** After sign-in/up from AuthModal, publish the draft if the user intended to. */
  async function handleAuthSuccess() {
    const preview =
      result ?? (mode === "text" ? livePreview : mode === "screenshot" ? result : null);
    if (!publishAfterAuthRef.current || !preview) return;

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

    await publishThread(token, preview);
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
      setError("Please paste a ChatGPT or DeepSeek share URL.");
      return;
    }

    if (!SUPPORTED_SHARE_URL.test(trimmed)) {
      setError(
        "Invalid URL. Use a ChatGPT or DeepSeek share link, e.g. https://chatgpt.com/share/… or https://chat.deepseek.com/share/…"
      );
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
      setMode("link");
    } catch (err) {
      setResult(null);
      setError(
        err instanceof Error ? err.message : "Failed to import share link."
      );
    } finally {
      setIsLoading(false);
    }
  }

  const isBusy =
    isLoading || isParsingText || isParsingScreenshot || isPublishing;
  const showTextForm = mode === "text" && !isParsingText;
  const showLinkResult = Boolean(result && mode === "link");
  const screenshotPreview: ScreenshotParsedPreview | null =
    mode === "screenshot" && result
      ? {
          source: result.source,
          title: result.title,
          originalUrl: result.originalUrl,
          messages: result.messages,
          verified: result.verified,
        }
      : null;

  function handleScreenshotPreviewChange(
    preview: ScreenshotParsedPreview | null
  ) {
    if (!preview) {
      setResult(null);
      return;
    }
    setResult({
      source: preview.source,
      title: preview.title,
      originalUrl: preview.originalUrl,
      messages: preview.messages,
      verified: preview.verified,
    });
  }

  const publishablePreview =
    result && mode === "link"
      ? result
      : mode === "text"
        ? livePreview
        : mode === "screenshot"
          ? screenshotPreview
          : result;

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

      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import a conversation</DialogTitle>
          <DialogDescription>
            Paste a public share link, conversation text, or upload a mobile
            scrolling screenshot to import a thread.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(value) => {
            setMode(value as ImportMode);
            setError(null);
            if (value === "text") {
              setResult(null);
              try {
                if (sessionStorage.getItem("chatshare_expect_paste") === "1") {
                  setShowPasteHint(true);
                  setPasteSourceLabel(
                    sessionStorage.getItem("chatshare_paste_source") ||
                      "AI"
                  );
                }
              } catch {
                // ignore
              }
            }
          }}
          className="w-full"
        >
          <TabsList className={IMPORT_TAB_LIST_CLASS}>
            <TabsTrigger value="link" disabled={isBusy}>
              Paste Link
            </TabsTrigger>
            <TabsTrigger value="text" disabled={isBusy}>
              Paste Text
            </TabsTrigger>
            <TabsTrigger value="screenshot" disabled={isBusy}>
              Screenshot
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-4">
            {showLinkResult && result ? (
              <>
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
                        className={cn(
                          "rounded-md border p-3 text-left",
                          message.role === "user"
                            ? "bg-muted/50 text-foreground"
                            : "bg-card text-card-foreground"
                        )}
                      >
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {message.role === "user" ? "USER" : "AI"}
                        </p>
                        <MarkdownRenderer content={message.content} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="home-import-tags-preview">Tags</Label>
                  <Input
                    id="home-import-tags-preview"
                    value={tagsInput}
                    onChange={(event) => setTagsInput(event.target.value)}
                    placeholder="react, nextjs, authentication"
                    disabled={isPublishing}
                    autoComplete="off"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={() => void handlePublish()}
                    disabled={
                      isPublishing || isAuthLoading || !publishablePreview
                    }
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
                    Import another link
                  </Button>
                </div>
              </>
            ) : (
              <>
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-import-url">
                      ChatGPT or DeepSeek share URL
                    </Label>
                    <Input
                      id="home-import-url"
                      type="url"
                      value={url}
                      onChange={(event) => {
                        setUrl(event.target.value);
                        setError(null);
                      }}
                      placeholder="https://chatgpt.com/share/… or https://chat.deepseek.com/share/…"
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

                <BookmarkletCard />
              </>
            )}
          </TabsContent>

          {showTextForm ? (
              <TabsContent value="text" className="mt-4 space-y-4">
                {showPasteHint ? (
                  <div className="space-y-3">
                    <div
                      role="status"
                      className="rounded-md border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm text-indigo-950 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-50"
                    >
                      Conversation copied from {pasteSourceLabel}! Press{" "}
                      <kbd className="rounded border border-indigo-300 bg-white/80 px-1 font-mono text-xs dark:border-indigo-700 dark:bg-indigo-900/60">
                        Ctrl+V
                      </kbd>{" "}
                      (or{" "}
                      <kbd className="rounded border border-indigo-300 bg-white/80 px-1 font-mono text-xs dark:border-indigo-700 dark:bg-indigo-900/60">
                        Cmd+V
                      </kbd>
                      ) to paste.
                    </div>
                    <Button
                      type="button"
                      className="w-full gap-2 sm:w-auto"
                      disabled={isReadingClipboard || isPublishing}
                      onClick={() => void handlePasteConversation()}
                    >
                      <ClipboardPaste className="h-4 w-4" />
                      {isReadingClipboard ? "Pasting…" : "Paste Conversation"}
                    </Button>
                    {clipboardNotice ? (
                      <p
                        role="alert"
                        className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-50"
                      >
                        {clipboardNotice}
                      </p>
                    ) : null}
                  </div>
                ) : null}
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="home-import-text">Raw Transcript</Label>
                    <RichTextEditor
                      ref={editorRef}
                      content={rawText}
                      onChange={(markdown) => {
                        setRawText(markdown);
                        setError(null);
                        if (markdown.trim()) {
                          setShowPasteHint(false);
                        }
                      }}
                      placeholder="Paste a conversation transcript here... (Rich text, bolding, lists, and code blocks will be preserved!)"
                      editable={!isPublishing}
                      dense
                      editorClassName="min-h-[180px]"
                    />
                    <p className="text-xs text-muted-foreground">
                      Paste from ChatGPT, Claude, or Gemini. Formatting becomes
                      Markdown automatically; use{" "}
                      <span className="font-medium text-foreground">User:</span>{" "}
                      /{" "}
                      <span className="font-medium text-foreground">
                        Gemini:
                      </span>{" "}
                      (or Assistant) labels for turn detection. Live preview
                      updates as you edit.
                    </p>
                  </div>

                  {livePreview && livePreview.messages.length > 0 ? (
                    <div className="mt-4 rounded-md border bg-muted/40 p-4">
                      <h4 className="mb-2 text-sm font-semibold text-foreground">
                        Conversation Preview
                      </h4>
                      <div className="max-h-64 space-y-3 overflow-y-auto">
                        {livePreview.messages.map((msg, idx) => {
                          const isUser = msg.role === "user";
                          return (
                            <div
                              key={`${msg.role}-${idx}`}
                              className={cn(
                                "rounded border p-3 text-sm",
                                isUser
                                  ? "border-border bg-muted/50 text-foreground"
                                  : "border-border bg-background text-foreground"
                              )}
                            >
                              <span
                                className={cn(
                                  "mb-2 inline-block rounded px-2 py-0.5 text-xs font-bold uppercase",
                                  isUser
                                    ? "bg-secondary text-secondary-foreground"
                                    : "bg-primary/15 text-primary"
                                )}
                              >
                                {isUser ? "USER" : "AI"}
                              </span>
                              <MarkdownRenderer content={msg.content} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : rawText.trim() ? (
                    <p className="rounded-md border border-dashed px-3 py-3 text-xs text-muted-foreground">
                      Waiting for labeled turns… Use{" "}
                      <span className="font-medium text-foreground">User:</span>{" "}
                      and{" "}
                      <span className="font-medium text-foreground">
                        Gemini:
                      </span>
                      /
                      <span className="font-medium text-foreground">
                        Assistant:
                      </span>{" "}
                      (date lines are ignored).
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <Label htmlFor="home-import-tags">Tags</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleSuggestTags}
                        disabled={isPublishing || !rawText.trim()}
                      >
                        <Sparkles className="h-4 w-4" />
                        Suggest Tags
                      </Button>
                    </div>
                    <Input
                      id="home-import-tags"
                      value={tagsInput}
                      onChange={(event) => setTagsInput(event.target.value)}
                      placeholder="react, nextjs, authentication"
                      disabled={isPublishing}
                      autoComplete="off"
                    />
                    <p className="text-xs text-muted-foreground">
                      Separate tags with commas. They are stored with the
                      published thread.
                    </p>
                    {visibleSuggestedTags.length > 0 ? (
                      <div className="flex flex-wrap items-center gap-2 pt-0.5">
                        {visibleSuggestedTags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => appendSuggestedTag(tag)}
                            className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                            aria-label={`Add tag ${tag}`}
                          >
                            <Badge
                              variant="outline"
                              className="cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
                            >
                              + {tag}
                            </Badge>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      onClick={() => void handlePublish()}
                      disabled={
                        !livePreview || isPublishing || isAuthLoading
                      }
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
                    {rawText.trim() ? (
                      <Button
                        type="button"
                        variant="outline"
                        disabled={isPublishing}
                        onClick={() => {
                          setRawText("");
                          setError(null);
                          setResult(null);
                        }}
                      >
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>

                <BookmarkletCard />
              </TabsContent>
            ) : null}

          <TabsContent value="screenshot" className="mt-4 space-y-4">
            <ScreenshotImportPanel
              preview={screenshotPreview}
              rawText={rawText}
              onPreviewChange={handleScreenshotPreviewChange}
              onRawTextChange={(markdown) => {
                setRawText(markdown);
                setError(null);
              }}
              onError={setError}
              onParsingChange={setIsParsingScreenshot}
              onParsed={(_, transcript) => {
                setSuggestedTags(suggestTags(transcript, 5));
                setMode("screenshot");
              }}
              editorRef={editorRef}
              disabled={isPublishing}
              footer={
                screenshotPreview ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-end justify-between gap-2">
                        <Label htmlFor="home-import-screenshot-tags">Tags</Label>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSuggestTags}
                          disabled={isPublishing || !rawText.trim()}
                        >
                          <Sparkles className="h-4 w-4" />
                          Suggest Tags
                        </Button>
                      </div>
                      <Input
                        id="home-import-screenshot-tags"
                        value={tagsInput}
                        onChange={(event) => setTagsInput(event.target.value)}
                        placeholder="react, nextjs, authentication"
                        disabled={isPublishing}
                        autoComplete="off"
                      />
                      {visibleSuggestedTags.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-2 pt-0.5">
                          {visibleSuggestedTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => appendSuggestedTag(tag)}
                              className="focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                              aria-label={`Add tag ${tag}`}
                            >
                              <Badge
                                variant="outline"
                                className="cursor-pointer border-dashed hover:border-primary hover:bg-primary/5"
                              >
                                + {tag}
                              </Badge>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        onClick={() => void handlePublish()}
                        disabled={
                          !screenshotPreview || isPublishing || isAuthLoading
                        }
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
                          setRawText("");
                          setResult(null);
                          setError(null);
                        }}
                      >
                        Clear
                      </Button>
                    </div>
                  </>
                ) : null
              }
            />
          </TabsContent>

          {mode === "text" && isParsingText ? (
              <TabsContent value="text" className="mt-4">
                <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Parsing conversation text…
                </div>
              </TabsContent>
            ) : null}

            {/* While link is loading, still surface the card so users can discover the bookmarklet */}
            {mode === "link" && isLoading ? (
              <div className="mt-4 space-y-4">
                <BookmarkletCard />
              </div>
            ) : null}
          </Tabs>

        {error ? (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
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
