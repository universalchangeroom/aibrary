"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseRawText } from "@/lib/parse-raw-text";
import { parseTags } from "@/lib/parse-transcript";
import { suggestTags } from "@/lib/suggest-tags";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const SOURCE_MODELS = [
  "Claude 3.5 Sonnet",
  "Gemini 1.5 Pro",
  "DeepSeek-R1",
  "GPT-4o",
  "Grok 2",
  "Other",
] as const;

export function ShareForm() {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [title, setTitle] = useState("");
  const [sourceModel, setSourceModel] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [transcriptText, setTranscriptText] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const parsedConversation = useMemo(() => {
    try {
      return parseRawText(transcriptText);
    } catch {
      return {
        source: "Pasted Text",
        title: "Imported Thread",
        messages: [] as Array<{ role: "user" | "assistant"; content: string }>,
      };
    }
  }, [transcriptText]);

  const appliedTagSet = useMemo(() => {
    return new Set(parseTags(tagsInput).map((tag) => tag.toLowerCase()));
  }, [tagsInput]);

  const visibleSuggestedTags = useMemo(
    () =>
      suggestedTags.filter((tag) => !appliedTagSet.has(tag.toLowerCase())),
    [suggestedTags, appliedTagSet]
  );

  function handleSuggestTags() {
    setSuggestedTags(suggestTags(transcriptText, 5));
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
    setSuggestedTags((prev) =>
      prev.filter((t) => t.toLowerCase() !== tag.toLowerCase())
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("Please add a title.");
      return;
    }

    if (!sourceModel) {
      setError("Please choose a source model.");
      return;
    }

    // Flush TipTap on Publish — React state can lag one paste/update behind.
    const markdown =
      editorRef.current?.getMarkdown()?.trim() || transcriptText.trim();
    if (markdown && markdown !== transcriptText) {
      setTranscriptText(markdown);
    }

    const parsed = (() => {
      try {
        return parseRawText(markdown);
      } catch {
        return parsedConversation;
      }
    })();

    const content = parsed.messages
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0
      )
      .map((m) => ({ role: m.role, content: m.content }));

    if (content.length === 0) {
      setError(
        "Could not parse the transcript. Use labels like User:/You: and Gemini:/Assistant:/ChatGPT:."
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const {
        data: { session },
        error: authError,
      } = await supabase.auth.getSession();

      if (authError) {
        throw authError;
      }

      const accessToken = session?.access_token;
      if (!accessToken || !session.user) {
        setError("You must be signed in to publish a chat.");
        setIsSubmitting(false);
        return;
      }

      const tags = parseTags(tagsInput);

      const response = await fetch("/api/threads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: trimmedTitle,
          source_model: sourceModel,
          tags,
          content,
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
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to publish thread.";
      setError(message);
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Debugging a Next.js hydration mismatch"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="source-model">Source Model</Label>
        <Select value={sourceModel} onValueChange={setSourceModel}>
          <SelectTrigger id="source-model">
            <SelectValue placeholder="Select a model" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_MODELS.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor="tags">Tags</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleSuggestTags}
            disabled={isSubmitting || !transcriptText.trim()}
          >
            <Sparkles className="h-4 w-4" />
            Suggest Tags
          </Button>
        </div>
        <Input
          id="tags"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="nextjs, react, debugging"
        />
        <p className="text-xs text-muted-foreground">
          Separate tags with commas. They are stored as a text array.
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

      <div className="space-y-2">
        <Label htmlFor="transcript">Raw Transcript</Label>
        <RichTextEditor
          ref={editorRef}
          content={transcriptText}
          onChange={(markdown) => {
            setTranscriptText(markdown);
            setError(null);
          }}
          placeholder="Paste a conversation transcript here... (Rich text, bolding, lists, and code blocks will be preserved!)"
          dense
          editorClassName="min-h-[220px]"
        />
        <p className="text-xs text-muted-foreground">
          Paste rich text from an AI chat. Formatting is kept as Markdown. Use
          User:/You: and Gemini:/Assistant: labels so turns parse for preview and
          publish.
        </p>
      </div>

      {parsedConversation.messages.length > 0 ? (
        <div className="mt-4 rounded-md border bg-muted/40 p-4">
          <h4 className="mb-2 text-sm font-semibold text-foreground">
            Conversation Preview
          </h4>
          <div className="max-h-72 space-y-3 overflow-y-auto">
            {parsedConversation.messages.map((msg, idx) => {
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
      ) : null}

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Publishing…
          </>
        ) : (
          "Publish to ChatShare"
        )}
      </Button>
    </form>
  );
}
