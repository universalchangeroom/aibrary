"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Loader2, Sparkles, Upload } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
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
  return resolveShareSourceModel(source) || "other";
}

function pdfDownloadFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
  const safe = base || "ChatShare Export";
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

export function ShareScreenshotForm() {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState<ScreenshotParsedPreview | null>(null);
  const [rawText, setRawText] = useState("");
  const [sourceModel, setSourceModel] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [summary, setSummary] = useState("");
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);

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

  async function handleGenerateSummary() {
    const transcript = (
      editorRef.current?.getMarkdown() ||
      rawText ||
      ""
    ).trim();
    if (!transcript || isSummarizing || isSubmitting) return;

    setError(null);
    setIsSummarizing(true);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        summary?: string;
        error?: string;
      };

      if (!response.ok || typeof payload.summary !== "string") {
        throw new Error(payload.error || "Failed to generate summary.");
      }

      setSummary(payload.summary.trim());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate summary."
      );
    } finally {
      setIsSummarizing(false);
    }
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
          summary: summary.trim() || null,
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
              "Your thread contains image or video content and has been submitted for admin review before appearing on the public feed."
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

  async function handleDownloadPdf() {
    if (isGeneratingPdf || isSubmitting || isParsing) return;

    const htmlContent = previewRef.current?.innerHTML?.trim();
    if (!htmlContent) {
      setError("Parse a screenshot to generate a PDF preview first.");
      return;
    }

    setError(null);
    setIsGeneratingPdf(true);

    try {
      const exportTitle = preview?.title?.trim() || "ChatShare Export";
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          htmlContent,
          title: exportTitle,
        }),
      });

      if (!response.ok) {
        let message = "Failed to generate PDF.";
        try {
          const payload = (await response.json()) as { error?: string };
          if (payload?.error) message = payload.error;
        } catch {
          // ignore JSON parse errors
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = pdfDownloadFilename(exportTitle);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to generate PDF."
      );
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  const persistentControls = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <Label htmlFor="share-screenshot-tags">Tags</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSuggestTags}
              disabled={
                isSubmitting ||
                isGeneratingPdf ||
                isSummarizing ||
                !rawText.trim()
              }
            >
              <Sparkles className="h-4 w-4" />
              Suggest Tags
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleGenerateSummary()}
              disabled={
                isSubmitting ||
                isGeneratingPdf ||
                isSummarizing ||
                !rawText.trim()
              }
              className="disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSummarizing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Summarizing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Generate Summary
                </>
              )}
            </Button>
          </div>
        </div>
        <Input
          id="share-screenshot-tags"
          value={tagsInput}
          onChange={(event) => setTagsInput(event.target.value)}
          placeholder="nextjs, react, debugging"
          disabled={isSubmitting || isGeneratingPdf || isSummarizing}
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

      <div className="space-y-2">
        <Label htmlFor="share-screenshot-summary">Summary (TL;DR)</Label>
        <Textarea
          id="share-screenshot-summary"
          value={summary}
          onChange={(event) => setSummary(event.target.value)}
          placeholder="Import or paste a conversation, then click Generate Summary..."
          rows={3}
          disabled={isSubmitting || isGeneratingPdf}
          className="min-h-[4.5rem] resize-y"
        />
      </div>
    </div>
  );

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
        previewContainerRef={previewRef}
        disabled={isSubmitting || isParsing || isGeneratingPdf}
        persistentControls={persistentControls}
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

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => void handlePublish()}
                  disabled={isSubmitting || isParsing || isGeneratingPdf}
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
                <Button
                  type="button"
                  variant="outline"
                  disabled={
                    isGeneratingPdf ||
                    isSubmitting ||
                    isParsing ||
                    !preview.messages.length
                  }
                  onClick={() => void handleDownloadPdf()}
                  className="w-full border-border bg-white text-foreground hover:bg-muted/60 sm:w-auto"
                >
                  {isGeneratingPdf ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating…
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Download PDF
                    </>
                  )}
                </Button>
              </div>
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
