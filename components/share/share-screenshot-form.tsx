"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, Upload } from "lucide-react";

import {
  ScreenshotImportPanel,
  type ScreenshotParsedPreview,
} from "@/components/import/screenshot-import-panel";
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
import {
  type RichTextEditorHandle,
} from "@/components/rich-text-editor";
import { parseRawText } from "@/lib/parse-raw-text";
import { parseTags } from "@/lib/parse-transcript";
import {
  resolveShareSourceModel,
  SHARE_SOURCE_MODEL_LABELS,
  SHARE_SOURCE_MODELS,
} from "@/lib/share-source-model";
import { suggestTags } from "@/lib/suggest-tags";
import { createClient } from "@/lib/supabase/client";

function inferSourceModel(source: string): string {
  return resolveShareSourceModel(source) || "Other";
}

export function ShareScreenshotForm() {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const [preview, setPreview] = useState<ScreenshotParsedPreview | null>(null);
  const [rawText, setRawText] = useState("");
  const [sourceModel, setSourceModel] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const appliedTagSet = useMemo(() => {
    return new Set(parseTags(tagsInput).map((tag) => tag.toLowerCase()));
  }, [tagsInput]);

  const visibleSuggestedTags = useMemo(
    () =>
      suggestedTags.filter((tag) => !appliedTagSet.has(tag.toLowerCase())),
    [suggestedTags, appliedTagSet]
  );

  function handleSuggestTags() {
    setSuggestedTags(suggestTags(rawText, 5));
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

  async function handlePublish() {
    setError(null);

    const markdown =
      editorRef.current?.getMarkdown()?.trim() || rawText.trim();
    if (markdown && markdown !== rawText) {
      setRawText(markdown);
    }

    if (!preview) {
      setError("Upload and parse a screenshot first.");
      return;
    }

    const trimmedTitle = preview.title.trim();
    if (!trimmedTitle) {
      setError("Please add a title.");
      return;
    }

    const model = sourceModel || inferSourceModel(preview.source);
    if (!model) {
      setError("Please choose a source model.");
      return;
    }

    const parsed = parseRawText(markdown);
    const messages = (parsed.messages ?? []).filter(
      (m) =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0
    );

    const content =
      messages.length > 0
        ? messages.map((m) => ({ role: m.role, content: m.content }))
        : preview.messages;

    if (content.length === 0) {
      setError("No conversation turns were detected. Edit the transcript or try another screenshot.");
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
          source_model: model,
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
      setError(
        err instanceof Error ? err.message : "Failed to publish thread."
      );
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <ScreenshotImportPanel
        preview={preview}
        rawText={rawText}
        onPreviewChange={setPreview}
        onRawTextChange={setRawText}
        onError={setError}
        onParsingChange={setIsParsing}
        onParsed={(nextPreview, transcript) => {
          setSuggestedTags(suggestTags(transcript, 5));
          if (!sourceModel) {
            setSourceModel(inferSourceModel(nextPreview.source));
          }
        }}
        editorRef={editorRef}
        disabled={isSubmitting || isParsing}
        footer={
          preview ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="share-screenshot-source-model">Source Model</Label>
                <Select value={sourceModel} onValueChange={setSourceModel}>
                  <SelectTrigger id="share-screenshot-source-model">
                    <SelectValue placeholder="Select a model" />
                  </SelectTrigger>
                  <SelectContent>
                    {SHARE_SOURCE_MODELS.map((model) => (
                      <SelectItem key={model} value={model}>
                        {SHARE_SOURCE_MODEL_LABELS[model] ?? model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <Label htmlFor="share-screenshot-tags">Tags</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSuggestTags}
                    disabled={isSubmitting || !rawText.trim()}
                  >
                    <Sparkles className="h-4 w-4" />
                    Suggest Tags
                  </Button>
                </div>
                <Input
                  id="share-screenshot-tags"
                  value={tagsInput}
                  onChange={(event) => setTagsInput(event.target.value)}
                  placeholder="nextjs, react, debugging"
                  disabled={isSubmitting}
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

              <Button
                type="button"
                onClick={() => void handlePublish()}
                disabled={isSubmitting || isParsing}
                className="w-full sm:w-auto"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    Publish to ChatShare
                  </>
                )}
              </Button>
            </>
          ) : null
        }
      />

      {error ? (
        <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
