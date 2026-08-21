"use client";

import {
  Check,
  ClipboardCopy,
  Copy,
  Download,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AddFootnoteDialog } from "@/components/feed/add-footnote-dialog";
import { ConversationView } from "@/components/feed/conversation-view";
import { FootnoteSheet } from "@/components/feed/footnote-sheet";
import { ThreadActions } from "@/components/feed/thread-actions";
import { FormattedTime } from "@/components/formatted-time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/use-auth";
import { generateThreadMarkdown } from "@/lib/export-markdown";
import {
  asChatMessages,
  type ChatMessage,
  type ThreadWithFootnotes,
} from "@/lib/types";

interface ThreadDetailViewProps {
  thread: ThreadWithFootnotes;
  isAuthenticated: boolean;
  currentUserId: string | null;
  viewerTokenBalance: number | null;
  viewerHasStarred: boolean;
}

type EditLayout = "cards" | "raw";

function cloneMessages(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }));
}

/** Safe download basename from thread title, e.g. "my-thread.md". */
function markdownFilename(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return `${base || "thread"}.md`;
}

/** Speaker label for assistant turns; keeps Raw Text re-parseable via parseRawText. */
function assistantSpeakerLabel(sourceModel: string | null): string {
  const model = (sourceModel || "").toLowerCase();
  if (model.includes("gemini")) return "Gemini";
  if (model.includes("claude")) return "Claude";
  if (model.includes("deepseek")) return "DeepSeek";
  if (
    model.includes("chatgpt") ||
    model.includes("gpt") ||
    model.includes("openai")
  ) {
    return "ChatGPT";
  }
  return "Assistant";
}

/**
 * Rebuild a labeled transcript from structured messages:
 * `User: …\n\nGemini: …` (label derived from source_model when possible).
 */
function messagesToRawTranscript(
  messages: ChatMessage[],
  sourceModel: string | null
): string {
  const aiLabel = assistantSpeakerLabel(sourceModel);

  return messages
    .filter(
      (message) => message.role === "user" || message.role === "assistant"
    )
    .map((message) => {
      const label = message.role === "user" ? "User" : aiLabel;
      return `${label}: ${message.content}`;
    })
    .join("\n\n");
}

async function parseTranscriptViaApi(text: string): Promise<ChatMessage[]> {
  const response = await fetch("/api/parse-text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  const payload = (await response.json().catch(() => null)) as {
    success?: boolean;
    error?: string;
    data?: { messages?: unknown };
  } | null;

  if (!response.ok || !payload?.success) {
    throw new Error(
      payload?.error ||
        "Could not parse the transcript. Use labels like User: and Gemini:/Assistant:."
    );
  }

  const messages = asChatMessages(payload.data?.messages).filter(
    (message) => message.role === "user" || message.role === "assistant"
  );

  if (messages.length === 0) {
    throw new Error(
      'Could not detect speaker turns. Use labels like "User:" / "You:" and "Gemini:" / "Assistant:".'
    );
  }

  if (messages.some((message) => !message.content.trim())) {
    throw new Error("Every parsed turn needs non-empty content.");
  }

  return messages;
}

/**
 * Thread details: view mode + owner inline edit mode with save via PUT /api/threads/[id].
 */
export function ThreadDetailView({
  thread: initialThread,
  isAuthenticated,
  currentUserId,
  viewerTokenBalance,
  viewerHasStarred,
}: ThreadDetailViewProps) {
  const router = useRouter();
  const { user, session } = useAuth();
  const [thread, setThread] = useState(initialThread);
  const [copied, setCopied] = useState(false);
  const [markdownCopied, setMarkdownCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLayout, setEditLayout] = useState<EditLayout>("cards");
  const [isSaving, setIsSaving] = useState(false);
  const [isSwitchingLayout, setIsSwitchingLayout] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [successToastMessage, setSuccessToastMessage] = useState(
    "Thread updated successfully!"
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState(initialThread.title);
  const [editMessages, setEditMessages] = useState<ChatMessage[]>(() =>
    cloneMessages(initialThread.content)
  );
  const [editRaw, setEditRaw] = useState(() =>
    messagesToRawTranscript(initialThread.content, initialThread.source_model)
  );

  const ownerId = thread.author_id;
  const isOwner = Boolean(user?.id && ownerId && user.id === ownerId);
  const footnoteCount = thread.footnotes.length;
  const busy = isSaving || isSwitchingLayout || isDeleting;

  useEffect(() => {
    setThread(initialThread);
  }, [initialThread.id, initialThread.updated_at]);

  useEffect(() => {
    if (!showSuccessToast) return;
    const longNotice = successToastMessage.length > 80;
    const timer = window.setTimeout(
      () => setShowSuccessToast(false),
      longNotice ? 7000 : 2800
    );
    return () => window.clearTimeout(timer);
  }, [showSuccessToast, successToastMessage]);

  // Surface publish flow notice (e.g. image content held for admin review).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const notice = window.sessionStorage.getItem("chatshare_publish_notice");
    if (!notice) return;
    window.sessionStorage.removeItem("chatshare_publish_notice");
    showToast(notice);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  function showToast(message: string) {
    setSuccessToastMessage(message);
    setShowSuccessToast(true);
  }

  function enterEditMode() {
    const messages = cloneMessages(thread.content);
    setEditTitle(thread.title);
    setEditMessages(messages);
    setEditRaw(messagesToRawTranscript(messages, thread.source_model));
    setEditLayout("cards");
    setSaveError(null);
    setIsEditing(true);
  }

  function cancelEdit() {
    if (busy) return;
    setEditTitle(thread.title);
    setEditMessages(cloneMessages(thread.content));
    setEditRaw(
      messagesToRawTranscript(thread.content, thread.source_model)
    );
    setEditLayout("cards");
    setSaveError(null);
    setIsEditing(false);
  }

  async function switchEditLayout() {
    if (busy) return;
    setSaveError(null);

    if (editLayout === "cards") {
      setEditRaw(
        messagesToRawTranscript(editMessages, thread.source_model)
      );
      setEditLayout("raw");
      return;
    }

    // Raw → cards: re-parse so turn cards match the transcript text.
    setIsSwitchingLayout(true);
    try {
      const parsed = await parseTranscriptViaApi(editRaw);
      setEditMessages(parsed);
      setEditLayout("cards");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Failed to parse transcript into cards."
      );
    } finally {
      setIsSwitchingLayout(false);
    }
  }

  async function saveChanges() {
    if (busy) return;

    const title = editTitle.trim();
    if (!title) {
      setSaveError("A non-empty title is required.");
      return;
    }

    const accessToken = session?.access_token;
    if (!accessToken) {
      setSaveError("You must be signed in to save changes.");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      let messagesToSave: ChatMessage[];

      if (editLayout === "raw") {
        messagesToSave = await parseTranscriptViaApi(editRaw);
        setEditMessages(messagesToSave);
      } else {
        if (
          editMessages.length === 0 ||
          editMessages.some((m) => !m.content.trim())
        ) {
          setSaveError(
            "Each message needs content. Remove empty turns or fill them in."
          );
          return;
        }
        messagesToSave = editMessages;
      }

      const response = await fetch(`/api/threads/${thread.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title,
          messages: messagesToSave.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        }),
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
        data?: {
          title?: string;
          content?: unknown;
          messages?: unknown;
          status?: string;
          updated_at?: string;
        };
      } | null;

      if (!response.ok || !payload?.success || !payload.data) {
        setSaveError(
          payload?.error || `Failed to save thread (${response.status}).`
        );
        return;
      }

      const savedMessages = asChatMessages(
        payload.data.messages ?? payload.data.content
      );
      const nextContent =
        savedMessages.length > 0
          ? savedMessages
          : cloneMessages(messagesToSave);

      setThread((prev) => ({
        ...prev,
        title:
          typeof payload.data!.title === "string"
            ? payload.data!.title
            : title,
        content: nextContent,
        status:
          typeof payload.data!.status === "string"
            ? payload.data!.status
            : prev.status,
        updated_at:
          typeof payload.data!.updated_at === "string"
            ? payload.data!.updated_at
            : prev.updated_at,
      }));
      setEditLayout("cards");
      setIsEditing(false);
      setSaveError(null);
      if (payload.message) {
        showToast(payload.message);
      } else {
        showToast("Thread updated successfully!");
      }
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Network error while saving. Please try again."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function confirmDeleteThread() {
    if (isDeleting) return;

    const accessToken = session?.access_token;
    if (!accessToken) {
      setDeleteError("You must be signed in to delete this thread.");
      return;
    }

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/threads/${thread.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const payload = (await response.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
      } | null;

      if (!response.ok || !payload?.success) {
        setDeleteError(
          payload?.error || `Failed to delete thread (${response.status}).`
        );
        return;
      }

      setDeleteOpen(false);
      showToast("Thread deleted");
      // Brief pause so the toast is visible before this page unmounts.
      window.setTimeout(() => {
        router.push("/");
        router.refresh();
      }, 600);
    } catch {
      setDeleteError("Network error while deleting. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  }

  async function copySystemPrompt() {
    const prompt = "No system prompt was shared for this conversation.";

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  async function copyThreadAsMarkdown() {
    try {
      const markdown = generateThreadMarkdown(thread);
      await navigator.clipboard.writeText(markdown);
      setMarkdownCopied(true);
      window.setTimeout(() => setMarkdownCopied(false), 2000);
    } catch {
      setMarkdownCopied(false);
    }
  }

  function downloadThreadMarkdown() {
    const markdown = generateThreadMarkdown(thread);
    const blob = new Blob([markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = markdownFilename(thread.title);
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function updateMessageContent(index: number, content: string) {
    setEditMessages((prev) =>
      prev.map((message, i) =>
        i === index ? { ...message, content } : message
      )
    );
  }

  function removeMessage(index: number) {
    setEditMessages((prev) => prev.filter((_, i) => i !== index));
  }

  function addMessage() {
    setEditMessages((prev) => {
      const last = prev[prev.length - 1];
      const nextRole: ChatMessage["role"] =
        last?.role === "user" ? "assistant" : "user";
      return [...prev, { role: nextRole, content: "" }];
    });
  }

  const editActions = (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        onClick={() => void saveChanges()}
        disabled={busy}
      >
        {isSaving ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        ) : null}
        {isSaving ? "Saving…" : "Save Changes"}
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={cancelEdit}
        disabled={busy}
      >
        Cancel
      </Button>
    </div>
  );

  return (
    <div className="flex flex-col gap-8">
      {showSuccessToast ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-50 max-w-md -translate-x-1/2 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-medium text-emerald-900 shadow-md"
        >
          {successToastMessage}
        </div>
      ) : null}

      {isOwner && thread.status === "pending_review" ? (
        <div
          role="status"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        >
          Your thread contains image content and has been submitted for admin
          review before appearing on the public feed.
        </div>
      ) : null}

      <header className="space-y-5 border-b pb-8">
        {/* Title — full width, never competes with action buttons */}
        <div className="min-w-0 space-y-2">
          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="text"
                value={editTitle}
                onChange={(event) => {
                  setEditTitle(event.target.value);
                  if (saveError) setSaveError(null);
                }}
                aria-label="Thread title"
                disabled={isSaving}
                className="h-auto w-full border-primary/40 px-3 py-2 text-2xl font-bold tracking-tight shadow-none sm:text-3xl"
              />
              <Badge
                variant="outline"
                className="border-primary/40 text-primary"
              >
                Editing
              </Badge>
            </div>
          ) : (
            <h1 className="flex min-w-0 items-start gap-2 text-2xl font-bold tracking-tight break-words sm:text-3xl">
              <span className="min-w-0 flex-1">{thread.title}</span>
              {footnoteCount > 0 ? (
                <span className="mt-1 shrink-0 text-amber-600" aria-hidden>
                  <MessageSquareWarning className="h-5 w-5" />
                </span>
              ) : null}
            </h1>
          )}
        </div>

        {/* Metadata: model, date, tags */}
        {!isEditing ? (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              {thread.source_model ? (
                <Badge variant="secondary">{thread.source_model}</Badge>
              ) : null}
              {thread.created_at ? (
                <FormattedTime
                  date={thread.created_at}
                  className="text-sm text-muted-foreground"
                />
              ) : null}
            </div>
            {thread.tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {thread.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {/* Utility actions — own row beneath metadata; wraps on narrow viewports */}
        <div
          className="flex flex-wrap items-center gap-2"
          role="toolbar"
          aria-label="Thread utilities"
        >
          {isAuthenticated && !isEditing ? (
            <AddFootnoteDialog threadId={thread.id} />
          ) : null}
          {footnoteCount > 0 && !isEditing ? (
            <FootnoteSheet
              footnotes={thread.footnotes}
              threadId={thread.id}
              trigger="header"
            />
          ) : null}
          {!isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => void copyThreadAsMarkdown()}
              >
                {markdownCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <ClipboardCopy className="h-4 w-4" />
                )}
                {markdownCopied ? "Copied!" : "Copy as Markdown"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={downloadThreadMarkdown}
              >
                <Download className="h-4 w-4" />
                Download .md
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copySystemPrompt}
              >
                {copied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {copied ? "Copied" : "Copy System Prompt"}
              </Button>
            </>
          ) : null}
          {isOwner && !isEditing ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={enterEditMode}
              >
                <Pencil className="h-4 w-4" />
                Edit Thread
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteError(null);
                  setDeleteOpen(true);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete Thread
              </Button>
            </>
          ) : null}
          {isEditing ? editActions : null}
        </div>

        {isEditing && saveError ? (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
          >
            {saveError}
          </p>
        ) : null}

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void switchEditLayout()}
              disabled={busy}
            >
              {isSwitchingLayout ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {editLayout === "cards"
                ? "Switch to Raw Text Editor"
                : "Switch to Card Editor"}
            </Button>
            {editLayout === "raw" ? (
              <p className="text-xs text-muted-foreground">
                Use{" "}
                <span className="font-medium">
                  {assistantSpeakerLabel(thread.source_model)}:
                </span>{" "}
                (or ChatGPT:/Claude:/Gemini:/DeepSeek:/Assistant:) and{" "}
                <span className="font-medium">User:</span> labels for each turn.
              </p>
            ) : null}
          </div>
        ) : null}

        {!isEditing ? (
          <div className="pt-1">
            <ThreadActions
              key={`thread-actions-${thread.id}-${viewerTokenBalance ?? "none"}-${viewerHasStarred ? "1" : "0"}`}
              threadId={thread.id}
              authorId={thread.author_id}
              currentUserId={currentUserId}
              totalTokens={
                typeof thread.total_tokens === "number"
                  ? thread.total_tokens
                  : 0
              }
              tokenBalance={viewerTokenBalance}
              starred={viewerHasStarred}
            />
          </div>
        ) : null}
      </header>

      {isEditing && editLayout === "raw" ? (
        <section className="flex flex-col gap-2" aria-label="Raw transcript editor">
          <label
            htmlFor="raw-transcript"
            className="text-sm font-medium text-foreground"
          >
            Raw Transcript
          </label>
          <Textarea
            id="raw-transcript"
            value={editRaw}
            onChange={(event) => {
              setEditRaw(event.target.value);
              if (saveError) setSaveError(null);
            }}
            disabled={busy}
            aria-label="Raw transcript"
            className="min-h-[min(70vh,40rem)] resize-y font-mono text-sm leading-relaxed"
            placeholder={`User: …\n\n${assistantSpeakerLabel(thread.source_model)}: …`}
          />
        </section>
      ) : (
        <ConversationView
          messages={isEditing ? editMessages : thread.content}
          footnotes={isEditing ? [] : thread.footnotes}
          threadId={thread.id}
          isEditing={isEditing && editLayout === "cards"}
          onMessageContentChange={updateMessageContent}
          onRemoveMessage={removeMessage}
          onAddMessage={addMessage}
        />
      )}

      {isEditing ? (
        <div className="flex flex-col gap-3 border-t pt-6">
          {saveError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {saveError}
            </p>
          ) : null}
          {editActions}
        </div>
      ) : null}

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => {
          if (isDeleting) return;
          setDeleteOpen(open);
          if (!open) setDeleteError(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete thread</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this thread? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {deleteError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive"
            >
              {deleteError}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void confirmDeleteThread()}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {isDeleting ? "Deleting…" : "Delete Thread"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
