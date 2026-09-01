"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode,
} from "react";
import { ImageIcon, Loader2 } from "lucide-react";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import {
  RichTextEditor,
  type RichTextEditorHandle,
} from "@/components/rich-text-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { messagesToLabeledTranscript } from "@/lib/messages-to-transcript";
import { cn } from "@/lib/utils";

export type ScreenshotParsedPreview = {
  source: string;
  title: string;
  originalUrl: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  verified?: boolean;
};

const SCREENSHOT_ACCEPT = ".png,.jpg,.jpeg,.webp";
const SCREENSHOT_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

function normalizeScreenshotPayload(payload: unknown): ScreenshotParsedPreview {
  if (!payload || typeof payload !== "object") {
    throw new Error("Unexpected response from screenshot parser.");
  }

  const record = payload as Record<string, unknown>;
  if (record.success === false) {
    throw new Error(
      typeof record.error === "string"
        ? record.error
        : "Failed to parse screenshot."
    );
  }

  const data =
    record.success === true && record.data && typeof record.data === "object"
      ? (record.data as Record<string, unknown>)
      : record;

  const messages = Array.isArray(data.messages)
    ? data.messages.filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          !!m &&
          typeof m === "object" &&
          (m.role === "user" || m.role === "assistant") &&
          typeof (m as { content?: unknown }).content === "string" &&
          String((m as { content: string }).content).trim().length > 0
      )
    : [];

  if (messages.length === 0) {
    throw new Error("No conversation turns were detected in this screenshot.");
  }

  return {
    source:
      typeof data.source === "string" && data.source.trim()
        ? data.source
        : "Screenshot",
    title:
      typeof data.title === "string" && data.title.trim()
        ? data.title
        : "Imported Screenshot Thread",
    originalUrl:
      typeof data.originalUrl === "string" ? data.originalUrl : "",
    messages,
    verified: false,
  };
}

type ScreenshotImportPanelProps = {
  preview: ScreenshotParsedPreview | null;
  rawText: string;
  onPreviewChange: (preview: ScreenshotParsedPreview | null) => void;
  onRawTextChange: (text: string) => void;
  onError?: (message: string | null) => void;
  onParsingChange?: (isParsing: boolean) => void;
  onParsed?: (preview: ScreenshotParsedPreview, transcript: string) => void;
  editorRef?: React.RefObject<RichTextEditorHandle>;
  disabled?: boolean;
  footer?: ReactNode;
};

export function ScreenshotImportPanel({
  preview,
  rawText,
  onPreviewChange,
  onRawTextChange,
  onError,
  onParsed,
  onParsingChange,
  editorRef,
  disabled = false,
  footer,
}: ScreenshotImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    onError?.(null);
    onPreviewChange(null);

    const mime = (file.type || "").toLowerCase();
    if (!SCREENSHOT_MIME.has(mime)) {
      onError?.("Unsupported file type. Use PNG, JPG, or WebP.");
      return;
    }

    setFileName(file.name);
    setIsParsing(true);
    onParsingChange?.(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse-screenshot", {
        method: "POST",
        body: formData,
      });

      const payload: unknown = await response.json();
      if (!response.ok) {
        const err = payload as { error?: string };
        throw new Error(err.error || "Failed to parse screenshot.");
      }

      const nextPreview = normalizeScreenshotPayload(payload);
      const transcript = messagesToLabeledTranscript(
        nextPreview.messages,
        nextPreview.source
      );

      onPreviewChange(nextPreview);
      onRawTextChange(transcript);
      onParsed?.(nextPreview, transcript);
    } catch (err) {
      onPreviewChange(null);
      onError?.(
        err instanceof Error ? err.message : "Failed to parse screenshot."
      );
    } finally {
      setIsParsing(false);
      onParsingChange?.(false);
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void handleFile(file);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void handleFile(file);
  }

  if (isParsing) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-md border border-dashed px-4 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Reading screenshot and extracting conversation…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragActive(false);
        }}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragActive
            ? "border-primary bg-primary/5"
            : "border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/50",
          disabled && "pointer-events-none opacity-60"
        )}
      >
        <ImageIcon className="h-10 w-10 text-muted-foreground" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Drop a mobile chat screenshot here
          </p>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, or WebP — long scrolling captures supported
          </p>
          {fileName ? (
            <p className="text-xs font-medium text-primary">Last file: {fileName}</p>
          ) : null}
        </div>
        <Button type="button" variant="secondary" size="sm" asChild>
          <span>Choose image</span>
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={SCREENSHOT_ACCEPT}
          className="sr-only"
          onChange={handleInputChange}
          disabled={disabled}
        />
      </div>

      <p className="text-xs text-muted-foreground">
        A vision model detects User vs AI turns and rebuilds Markdown (code
        blocks, lists, and formatting preserved).
      </p>

      {preview && preview.messages.length > 0 ? (
        <>
          <div className="rounded-md border bg-muted/40 p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary">{preview.source}</Badge>
              <span className="text-xs text-muted-foreground">
                {preview.messages.length} messages
              </span>
            </div>
            <h4 className="mb-2 text-sm font-semibold text-foreground">
              Conversation Preview
            </h4>
            <div className="max-h-64 space-y-3 overflow-y-auto">
              {preview.messages.map((msg, idx) => {
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

          <div className="space-y-2">
            <Label htmlFor="screenshot-import-title">Thread title</Label>
            <Input
              id="screenshot-import-title"
              value={preview.title}
              onChange={(event) =>
                onPreviewChange({ ...preview, title: event.target.value })
              }
              disabled={disabled}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="screenshot-import-text">Editable transcript</Label>
            <RichTextEditor
              ref={editorRef}
              content={rawText}
              onChange={(markdown) => {
                onRawTextChange(markdown);
                onError?.(null);
              }}
              placeholder="Parsed transcript appears here…"
              editable={!disabled}
              dense
              editorClassName="min-h-[160px]"
            />
          </div>

          {footer}
        </>
      ) : null}
    </div>
  );
}
