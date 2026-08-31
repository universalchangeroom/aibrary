"use client";

import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Code2,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  type LucideIcon,
} from "lucide-react";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Markdown } from "tiptap-markdown";
import type { Editor } from "@tiptap/react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type RichTextEditorProps = {
  /** Markdown string controlled by the parent form. */
  content?: string;
  /** Called with the editor content as Markdown whenever it changes. */
  onChange?: (markdownString: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
  editable?: boolean;
  /** Slightly denser height for long transcript pastes. */
  dense?: boolean;
};

type ToolbarButtonProps = {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  icon: LucideIcon;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  icon: Icon,
}: ToolbarButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "h-8 w-8 p-0 text-muted-foreground",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export type RichTextEditorHandle = {
  /** Latest Markdown (falls back to HTML images / plain text so Publish never sees an empty editor). */
  getMarkdown: () => string;
};

function markdownImagesFromHtml(html: string): string[] {
  const out: string[] = [];
  const tags = String(html || "").match(/<img\b[^>]*>/gi) ?? [];
  for (const tag of tags) {
    const src = tag.match(/\bsrc\s*=\s*["']([^"']+)["']/i)?.[1]?.trim();
    if (!src) continue;
    const alt =
      tag.match(/\balt\s*=\s*["']([^"']*)["']/i)?.[1]?.trim() ||
      "Generated image";
    out.push(`![${alt}](${src})`);
  }
  return out;
}

function mergeMarkdownImages(markdown: string, html: string): string {
  let next = String(markdown || "");
  for (const imgMd of markdownImagesFromHtml(html)) {
    const src = imgMd.match(/\]\(([^)]+)\)/)?.[1] ?? "";
    if ((src && next.includes(src)) || next.includes(imgMd)) continue;
    next = next.trim() ? `${next.trimEnd()}\n\n${imgMd}` : imgMd;
  }
  return next;
}

function getMarkdown(
  editor:
    | Editor
    | {
        storage: unknown;
        getText?: (opts?: { blockSeparator?: string }) => string;
        getHTML?: () => string;
      }
    | null
): string {
  if (!editor) return "";
  let html = "";
  try {
    if (typeof editor.getHTML === "function") {
      html = editor.getHTML() ?? "";
    }
  } catch {
    html = "";
  }

  try {
    const storage = editor.storage as {
      markdown?: { getMarkdown?: () => string };
    };
    const fromExt = storage.markdown?.getMarkdown?.() ?? "";
    const withImages = mergeMarkdownImages(
      typeof fromExt === "string" ? fromExt : "",
      html
    );
    if (withImages.trim()) return withImages;
  } catch {
    // TipTap 3 + tiptap-markdown can fail to serialize; fall through.
  }

  const fromHtmlOnly = mergeMarkdownImages("", html);
  if (fromHtmlOnly.trim()) return fromHtmlOnly;

  try {
    if (typeof editor.getText === "function") {
      return editor.getText({ blockSeparator: "\n\n" }) ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

/**
 * Reusable TipTap editor that reads/writes content as Markdown.
 * HTML/rich-text paste (ChatGPT, Claude, Gemini, etc.) is converted into
 * TipTap nodes (ProseMirror); parents receive structured Markdown via onChange.
 */
export const RichTextEditor = forwardRef<RichTextEditorHandle, RichTextEditorProps>(
  function RichTextEditor(
    {
      content = "",
      onChange,
      placeholder = "Write something…",
      className,
      editorClassName,
      editable = true,
      dense = false,
    },
    ref
  ) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    editable,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:pointer-events-none before:float-left before:h-0 before:text-muted-foreground before:content-[attr(data-placeholder)]",
      }),
      Image.configure({
        inline: true,
        allowBase64: true,
      }),
      Markdown.configure({
        // HTML paste → document; serialization via getMarkdown() on every update.
        html: true,
        transformPastedText: true,
        transformCopiedText: false,
        breaks: true,
        linkify: false,
        tightLists: true,
      }),
    ],
    content: content || "",
    editorProps: {
      attributes: {
        class: cn(
          dense
            ? "min-h-[200px] max-h-[min(50vh,22rem)]"
            : "min-h-[160px] max-h-[min(60vh,28rem)]",
          "w-full overflow-y-auto px-3 py-2.5 text-sm leading-relaxed outline-none",
          "prose-sm max-w-none",
          "[&_h2]:mb-2 [&_h2]:mt-3 [&_h2]:text-lg [&_h2]:font-semibold",
          "[&_h3]:mb-1.5 [&_h3]:mt-2.5 [&_h3]:text-base [&_h3]:font-semibold",
          "[&_p]:my-1.5",
          "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
          "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5",
          "[&_li]:my-0.5",
          "[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground",
          "[&_code]:rounded-md [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]",
          "[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border [&_pre]:bg-muted/60 [&_pre]:p-3",
          "[&_pre_code]:bg-transparent [&_pre_code]:p-0",
          "[&_strong]:font-semibold",
          "[&_img]:my-2 [&_img]:max-h-64 [&_img]:max-w-full [&_img]:rounded-md [&_img]:object-contain",
          editorClassName
        ),
      },
      transformPastedHTML(html) {
        // Preserve structure; strip chars that break line-start speaker labels.
        return html
          .replace(/\u200B/g, "")
          .replace(/\uFEFF/g, "")
          .replace(/&nbsp;/g, " ");
      },
      transformPastedText(text) {
        return text.replace(/\u200B/g, "").replace(/\uFEFF/g, "");
      },
    },
    onUpdate: ({ editor: current }) => {
      const markdown = getMarkdown(current);
      onChangeRef.current?.(markdown);
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      getMarkdown: () => getMarkdown(editor),
    }),
    [editor]
  );

  // Don't clobber a non-empty document with an empty parent (failed serialize / stale state).
  useEffect(() => {
    if (!editor) return;
    const current = getMarkdown(editor).trimEnd();
    const next = (content ?? "").trimEnd();
    if (current === next) return;
    if (!next && current) return;
    editor.commands.setContent(content || "", { emitUpdate: false });
  }, [content, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editable, editor]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-md border border-input bg-background shadow-sm",
          className
        )}
      >
        <div className="h-10 border-b border-border bg-muted/40" />
        <div className="min-h-[160px] px-3 py-2.5 text-sm text-muted-foreground">
          Loading editor…
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-md border border-input bg-background shadow-sm focus-within:ring-1 focus-within:ring-ring",
        !editable && "opacity-80",
        className
      )}
    >
      <div
        className="flex flex-wrap items-center gap-0.5 border-b border-border bg-muted/40 px-1.5 py-1"
        role="toolbar"
        aria-label="Text formatting"
      >
        <ToolbarButton
          label="Bold"
          icon={Bold}
          active={editor.isActive("bold")}
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarButton
          label="Italic"
          icon={Italic}
          active={editor.isActive("italic")}
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Heading 2"
          icon={Heading2}
          active={editor.isActive("heading", { level: 2 })}
          disabled={!editable}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
        />
        <ToolbarButton
          label="Heading 3"
          icon={Heading3}
          active={editor.isActive("heading", { level: 3 })}
          disabled={!editable}
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Bullet list"
          icon={List}
          active={editor.isActive("bulletList")}
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarButton
          label="Ordered list"
          icon={ListOrdered}
          active={editor.isActive("orderedList")}
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <ToolbarButton
          label="Code block"
          icon={Code2}
          active={editor.isActive("codeBlock")}
          disabled={!editable}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        />
        <span className="mx-1 h-5 w-px bg-border" aria-hidden />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!editable}
          onClick={() =>
            editor.chain().focus().insertContent("USER:\n").run()
          }
          aria-label="Insert User tag"
          title="Insert User:"
          className="h-8 px-2 text-xs font-medium text-muted-foreground"
        >
          User:
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!editable}
          onClick={() => editor.chain().focus().insertContent("AI:\n").run()}
          aria-label="Insert AI tag"
          title="Insert AI:"
          className="h-8 px-2 text-xs font-medium text-muted-foreground"
        >
          AI:
        </Button>
      </div>

      <EditorContent editor={editor} />
    </div>
  );
});
