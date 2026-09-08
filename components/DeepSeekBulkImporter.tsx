"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import JSZip from "jszip";
import {
  FileDown,
  FileJson,
  FileText,
  Loader2,
  Send,
  Upload,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export interface DeepSeekImportedMessage {
  role: string;
  content: string;
}

export interface DeepSeekParsedChat {
  id: string;
  title: string;
  createTime: string | null;
  model: string;
  messages: DeepSeekImportedMessage[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function conversationList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const record = asRecord(value);
  if (!record) return [];
  if (Array.isArray(record.conversations)) return record.conversations;
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.chats)) return record.chats;
  if (Array.isArray(record.chat_sessions)) return record.chat_sessions;
  if (record.data && record.data !== value) return conversationList(record.data);
  return [];
}

function textFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map(textFromUnknown).filter(Boolean).join("\n");
  }

  const record = asRecord(value);
  if (!record) return "";
  for (const key of ["text", "content", "value", "parts", "message"]) {
    if (record[key] != null && record[key] !== value) {
      const text = textFromUnknown(record[key]);
      if (text) return text;
    }
  }
  return "";
}

function roleFromUnknown(message: Record<string, unknown>): string {
  const author = asRecord(message.author);
  const rawRole =
    message.role ??
    message.sender ??
    message.sender_type ??
    message.message_role ??
    message.type ??
    author?.role ??
    author?.name;
  const role = typeof rawRole === "string" ? rawRole.trim().toLowerCase() : "";

  if (role === "user" || role === "human") return "user";
  if (
    role === "assistant" ||
    role === "ai" ||
    role === "bot" ||
    role === "model"
  ) {
    return "assistant";
  }
  if (role === "system") return "system";
  if (message.is_user === true) return "user";
  if (message.is_user === false) return "assistant";
  return role || "assistant";
}

function exportDateMilliseconds(value: unknown): number {
  if (value == null || value === "") return Number.NaN;
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim())
        ? Number(value)
        : Number.NaN;
  let milliseconds = Number.isFinite(numeric) ? numeric : Number.NaN;

  if (Number.isFinite(milliseconds)) {
    if (milliseconds > 100_000_000_000_000) milliseconds /= 1_000;
    else if (milliseconds < 10_000_000_000) milliseconds *= 1_000;
    return milliseconds;
  }
  return Date.parse(String(value));
}

function messagesFromMapping(
  chat: Record<string, unknown>
): DeepSeekImportedMessage[] | null {
  const mapping = asRecord(chat.mapping);
  if (!mapping) return null;

  return Object.values(mapping)
    .flatMap((value, index) => {
      const node = asRecord(value);
      const message = asRecord(node?.message);
      const fragments = message?.fragments;
      if (!message || !Array.isArray(fragments) || fragments.length === 0) {
        return [];
      }

      const fragment = asRecord(fragments[0]);
      if (!fragment) return [];
      const content = textFromUnknown(fragment.content).trim();
      if (!content) return [];

      const type =
        typeof fragment.type === "string"
          ? fragment.type.trim().toUpperCase()
          : "";
      const role =
        type === "REQUEST"
          ? "user"
          : type === "RESPONSE"
            ? "assistant"
            : roleFromUnknown(fragment);

      return [
        {
          role,
          content,
          insertedAt: exportDateMilliseconds(message.inserted_at),
          originalIndex: index,
        },
      ];
    })
    .sort((a, b) => {
      const aTime = Number.isFinite(a.insertedAt)
        ? a.insertedAt
        : Number.POSITIVE_INFINITY;
      const bTime = Number.isFinite(b.insertedAt)
        ? b.insertedAt
        : Number.POSITIVE_INFINITY;
      return aTime - bTime || a.originalIndex - b.originalIndex;
    })
    .map(({ role, content }) => ({ role, content }));
}

function messagesFromChat(chat: Record<string, unknown>): unknown[] {
  for (const key of [
    "messages",
    "chat_messages",
    "chatMessages",
    "turns",
    "history",
  ]) {
    if (Array.isArray(chat[key])) return chat[key];
  }

  const data = asRecord(chat.data);
  if (data) {
    const nested = messagesFromChat(data);
    if (nested.length > 0) return nested;
  }

  return [];
}

function readableExportDate(value: unknown): string | null {
  const date = new Date(exportDateMilliseconds(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function mapDeepSeekExport(value: unknown): DeepSeekParsedChat[] {
  return conversationList(value).flatMap((item, index) => {
    const chat = asRecord(item);
    if (!chat) return [];

    const mappedMessages = messagesFromMapping(chat);
    const messages =
      mappedMessages ??
      messagesFromChat(chat).flatMap((item) => {
        const outer = asRecord(item);
        const message = asRecord(outer?.message) ?? outer;
        if (!message) return [];
        const content = textFromUnknown(
          message.content ?? message.text ?? message.message
        ).trim();
        if (!content) return [];
        return [{ role: roleFromUnknown(message), content }];
      });

    const rawId =
      typeof chat.id === "string" || typeof chat.id === "number"
        ? String(chat.id)
        : "";
    const id = rawId.trim() || `deepseek-chat-${index + 1}`;

    return [
      {
        id,
        title:
          typeof (chat.title ?? chat.name) === "string" &&
          String(chat.title ?? chat.name).trim()
            ? String(chat.title ?? chat.name).trim()
            : `Untitled conversation ${index + 1}`,
        createTime: readableExportDate(
          chat.inserted_at ??
            chat.updated_at ??
            chat.insert_time ??
            chat.create_time ??
            chat.created_at ??
            chat.insertTime ??
            chat.createTime ??
            chat.timestamp
        ),
        model:
          typeof (chat.model ??
            chat.model_name ??
            chat.modelName ??
            chat.model_id) === "string" &&
          String(
            chat.model ?? chat.model_name ?? chat.modelName ?? chat.model_id
          ).trim()
            ? String(
                chat.model ??
                  chat.model_name ??
                  chat.modelName ??
                  chat.model_id
              ).trim()
            : "DeepSeek",
        messages,
      },
    ];
  });
}

function parseMarkdownChat(
  markdown: string,
  file: File,
  fileIndex: number
): DeepSeekParsedChat {
  const title =
    markdown.match(/^#\s+(.+?)\s*$/m)?.[1]?.trim() ||
    file.name.replace(/\.(?:md|txt)$/i, "").trim() ||
    `Imported conversation ${fileIndex + 1}`;
  const rawDate = markdown.match(/^- Date:\s*(.+?)\s*$/im)?.[1]?.trim();
  const model =
    markdown.match(/^- Model:\s*(.+?)\s*$/im)?.[1]?.trim() || "DeepSeek";
  const messages = markdown.split(/^---\s*$/m).flatMap((section) => {
    const heading = section.match(/^##\s+(User|Assistant|System)\s*$/im);
    if (!heading || heading.index == null) return [];

    const content = section
      .slice(heading.index + heading[0].length)
      .trim();
    if (!content) return [];

    return [
      {
        role: heading[1]!.toLowerCase(),
        content,
      },
    ];
  });

  return {
    id: `markdown-${file.name}-${file.lastModified}-${fileIndex}`,
    title,
    createTime: readableExportDate(rawDate),
    model,
    messages,
  };
}

function formatCreateTime(value: string | null): string {
  if (value == null) return "Unknown date";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Unknown date"
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function chatToMarkdown(chat: DeepSeekParsedChat): string {
  const metadata = [
    `# ${chat.title}`,
    "",
    `- Date: ${formatCreateTime(chat.createTime)}`,
    `- Model: ${chat.model}`,
    "",
    "---",
    "",
  ];
  const messages = chat.messages.flatMap((message) => {
    const role = message.role.trim().toLowerCase();
    const heading =
      role === "user"
        ? "User"
        : role === "assistant"
          ? "Assistant"
          : role === "system"
            ? "System"
            : message.role.trim() || "Message";
    return [`## ${heading}`, "", message.content.trim(), "", "---", ""];
  });

  return [...metadata, ...messages].join("\n").trimEnd() + "\n";
}

function markdownFilename(title: string): string {
  const sanitized = title
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  return `${sanitized || "untitled_conversation"}.md`;
}

function readFileText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error(`${file.name} could not be read.`));
    reader.readAsText(file);
  });
}

async function parseImportFile(
  file: File,
  fileIndex: number
): Promise<DeepSeekParsedChat[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "json" && extension !== "md" && extension !== "txt") {
    throw new Error(`${file.name} is not a JSON or Markdown file.`);
  }

  const text = await readFileText(file);
  if (extension === "md" || extension === "txt") {
    return [parseMarkdownChat(text, file, fileIndex)];
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(text) as unknown;
  } catch {
    throw new Error(`${file.name} is not valid JSON.`);
  }

  console.log(
    "[DeepSeekBulkImporter] First parsed chat object:",
    conversationList(decoded)[0] ?? null
  );
  const chats = mapDeepSeekExport(decoded);
  if (chats.length === 0) {
    throw new Error(`No conversations were found in ${file.name}.`);
  }
  return chats;
}

function appendUniqueChats(
  current: DeepSeekParsedChat[],
  incoming: DeepSeekParsedChat[]
): DeepSeekParsedChat[] {
  const usedIds = new Set(current.map((chat) => chat.id));
  const uniqueIncoming = incoming.map((chat) => {
    const baseId = chat.id;
    let id = baseId;
    let suffix = 2;
    while (usedIds.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    usedIds.add(id);
    return id === chat.id ? chat : { ...chat, id };
  });
  return [...current, ...uniqueIncoming];
}

export function DeepSeekBulkImporter() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [parsedChats, setParsedChats] = useState<DeepSeekParsedChat[]>([]);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(
    () => new Set()
  );
  const [isUploading, setIsUploading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  async function readFiles(files: File[]) {
    if (files.length === 0 || isUploading) return;
    setIsUploading(true);
    setError(null);

    try {
      const results = await Promise.allSettled(
        files.map((file, index) => parseImportFile(file, index))
      );
      const imported = results.flatMap((result) =>
        result.status === "fulfilled" ? result.value : []
      );
      const failures = results.flatMap((result) =>
        result.status === "rejected"
          ? [
              result.reason instanceof Error
                ? result.reason.message
                : "A file could not be imported.",
            ]
          : []
      );

      if (imported.length > 0) {
        setParsedChats((current) => appendUniqueChats(current, imported));
      }
      if (failures.length > 0) {
        setError(failures.join(" "));
      } else if (imported.length === 0) {
        setError("No conversations were found in the selected files.");
      }
    } finally {
      setIsUploading(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length > 0) void readFiles(files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const files = Array.from(event.dataTransfer.files ?? []);
    if (files.length > 0) void readFiles(files);
  }

  function toggleChat(id: string) {
    setSelectedChatIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleBulkMarkdownDownload() {
    if (selectedChatIds.size === 0 || isExporting) return;

    setIsExporting(true);
    setError(null);

    try {
      const zip = new JSZip();
      const usedFilenames = new Set<string>();

      for (const id of Array.from(selectedChatIds)) {
        const chat = parsedChats.find((candidate) => candidate.id === id);
        if (!chat) continue;

        const baseFilename = markdownFilename(chat.title);
        let filename = baseFilename;
        let duplicateIndex = 2;
        while (usedFilenames.has(filename)) {
          filename = baseFilename.replace(/\.md$/, `_${duplicateIndex}.md`);
          duplicateIndex += 1;
        }
        usedFilenames.add(filename);
        zip.file(filename, chatToMarkdown(chat));
      }

      if (usedFilenames.size === 0) {
        throw new Error("No selected conversations were available to export.");
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = "ChatShare_Export.zip";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "The Markdown archive could not be generated."
      );
    } finally {
      setIsExporting(false);
    }
  }

  const selectedCount = selectedChatIds.size;
  const canPublish = selectedCount > 0 && selectedCount <= 5;
  const canDownloadPdfs = selectedCount > 0 && selectedCount <= 10;
  const canDownloadMarkdown = selectedCount > 0;
  const allSelected =
    parsedChats.length > 0 && selectedCount === parsedChats.length;

  return (
    <section className="space-y-5">
      <div
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          isDragging
            ? "border-amber-500 bg-amber-100/70"
            : "border-amber-300 bg-stone-50 hover:border-amber-400 hover:bg-amber-50/60"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".json,.md,.txt,application/json,text/markdown,text/plain"
          multiple
          onChange={handleFileChange}
          className="sr-only"
        />
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-3">
          {isUploading ? (
            <Loader2 className="h-9 w-9 animate-spin text-amber-700" />
          ) : (
            <Upload className="h-9 w-9 text-amber-700" />
          )}
          {parsedChats.length === 0 && !isUploading ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-semibold text-slate-900">
                  Bulk Staging &amp; Local Refinery
                </h2>
                <p className="mx-auto mt-1 max-w-2xl text-sm leading-relaxed text-stone-600">
                  Drag &amp; drop your DeepSeek conversations.json export or a
                  batch of .md chat files. Everything parses in-memory in your
                  browser&apos;s RAM—nothing touches the server or database
                  until you say so.
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="rounded-full border border-stone-300 bg-white/80 px-3 py-1 text-xs font-medium text-slate-700">
                  🔒 100% Private (Client-Side Memory)
                </span>
                <span className="rounded-full border border-amber-300 bg-amber-50/80 px-3 py-1 text-xs font-medium text-amber-900">
                  ⚡ Publish up to 5 curated threads daily
                </span>
                <span className="rounded-full border border-orange-300 bg-orange-50/80 px-3 py-1 text-xs font-medium text-orange-900">
                  📦 Bulk export unlimited Markdown ZIPs
                </span>
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="border-amber-300 bg-white hover:bg-amber-50"
          >
            <FileJson className="h-4 w-4" />
            {isUploading ? "Reading files…" : "Choose JSON or Markdown"}
          </Button>
        </div>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {parsedChats.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-medium text-stone-700">
              {parsedChats.length} conversations parsed ·{" "}
              {selectedCount} selected
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setSelectedChatIds(
                  allSelected
                    ? new Set()
                    : new Set(parsedChats.map((chat) => chat.id))
                )
              }
            >
              {allSelected ? "Clear selection" : "Select all"}
            </Button>
          </div>

          <div className="sticky top-16 z-10 space-y-2 rounded-xl border border-amber-200 bg-stone-50/95 p-3 shadow-lg backdrop-blur">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                disabled={!canPublish}
                onClick={() =>
                  console.log(
                    "Bulk Discover publish requested",
                    Array.from(selectedChatIds)
                  )
                }
              >
                <Send className="h-4 w-4" />
                Publish to Discover (Max 5)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canDownloadPdfs}
                onClick={() =>
                  console.log(
                    "Bulk PDF download requested",
                    Array.from(selectedChatIds)
                  )
                }
              >
                <FileDown className="h-4 w-4" />
                Download PDFs (Max 10)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!canDownloadMarkdown || isExporting}
                onClick={() => void handleBulkMarkdownDownload()}
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {isExporting
                  ? "Creating ZIP…"
                  : "Download Markdown (No Limit)"}
              </Button>
            </div>

            {selectedCount > 5 ? (
              <p className="text-xs font-medium text-red-700">
                Reduce selection to 5 or fewer to publish to Discover.
              </p>
            ) : null}
            {selectedCount > 10 ? (
              <p className="text-xs font-medium text-red-700">
                Reduce selection to 10 or fewer to generate PDFs.
              </p>
            ) : null}
          </div>

          <div className="divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white">
            {parsedChats.map((chat) => (
              <label
                key={chat.id}
                className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-amber-50/50"
              >
                <input
                  type="checkbox"
                  checked={selectedChatIds.has(chat.id)}
                  onChange={() => toggleChat(chat.id)}
                  className="mt-1 h-4 w-4 rounded border-stone-300 accent-amber-600"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-900">
                    {chat.title}
                  </span>
                  <span className="mt-1 block text-xs text-stone-500">
                    {chat.model || "Unknown model"} · {chat.messages.length}{" "}
                    messages · {formatCreateTime(chat.createTime)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

export default DeepSeekBulkImporter;
