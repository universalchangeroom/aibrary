"use client";

import { Check, Copy, ImageIcon } from "lucide-react";
import {
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type MarkdownRendererProps = {
  content: string;
  className?: string;
};

type CodeProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
  node?: unknown;
};

type ImgProps = ComponentPropsWithoutRef<"img"> & {
  node?: unknown;
};

function languageFromClassName(className?: string): string {
  const match = /language-([\w#+-]+)/.exec(className ?? "");
  return match?.[1] ?? "text";
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="group relative my-3 overflow-hidden rounded-lg border border-zinc-700/80 bg-zinc-950 shadow-sm dark:border-zinc-700">
      <div className="flex items-center justify-between gap-2 border-b border-zinc-800 bg-zinc-900/90 px-3 py-1.5">
        <span className="font-mono text-[11px] uppercase tracking-wide text-zinc-400">
          {language}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void copyCode()}
          className={cn(
            "h-7 shrink-0 gap-1.5 px-2 text-xs",
            copied
              ? "text-emerald-400 hover:bg-zinc-800 hover:text-emerald-300"
              : "text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
          )}
          aria-label={copied ? "Code copied" : "Copy code"}
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied!" : "Copy Code"}
        </Button>
      </div>
      <SyntaxHighlighter
        style={vscDarkPlus}
        language={language}
        PreTag="div"
        customStyle={{
          margin: 0,
          padding: "1rem",
          background: "rgb(9 9 11)",
          fontSize: "0.8125rem",
          lineHeight: 1.55,
        }}
        codeTagProps={{
          style: {
            fontFamily:
              "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            color: "#e4e4e7",
          },
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}

function MarkdownCode({
  className,
  children,
  inline,
  ...props
}: CodeProps): ReactNode {
  const text = String(children ?? "").replace(/\n$/, "");
  // Fenced blocks: language-* class (and/or inline=false in some versions).
  const isBlock =
    inline === false ||
    Boolean(className?.includes("language-")) ||
    text.includes("\n");

  if (!isBlock) {
    return (
      <code
        className={cn(
          "rounded-md border border-border bg-background/80 px-1.5 py-0.5 font-mono text-[0.85em] text-foreground shadow-sm",
          "dark:border-border dark:bg-muted/80 dark:text-foreground",
          className
        )}
        {...props}
      >
        {children}
      </code>
    );
  }

  return (
    <CodeBlock language={languageFromClassName(className)} code={text} />
  );
}

/**
 * Markdown images (`![alt](url)`): responsive thumbnail, open full size in a
 * new tab, graceful fallback when the URL is broken/expired.
 */
function MarkdownImage({ src, alt, title, className, ...rest }: ImgProps) {
  const [failed, setFailed] = useState(false);
  const href = typeof src === "string" ? src.trim() : "";
  const label = (alt || title || "Image").trim() || "Image";

  if (!href || failed) {
    return (
      <span
        role="img"
        aria-label={
          failed || href
            ? `${label}: Original image unavailable`
            : "Original image unavailable"
        }
        className={cn(
          "my-3 flex max-h-64 w-full max-w-md flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-muted-foreground shadow-sm",
          className
        )}
      >
        <ImageIcon className="h-8 w-8 shrink-0 opacity-70" aria-hidden />
        <span className="max-w-full px-2 text-center text-xs font-medium">
          Original image unavailable
          {label && label !== "Image" ? (
            <span className="mt-1 block truncate text-[11px] font-normal opacity-80">
              {label}
            </span>
          ) : null}
        </span>
      </span>
    );
  }

  function handleError(_event: SyntheticEvent<HTMLImageElement>) {
    setFailed(true);
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={title || "Click to view full image ↗"}
      className={cn(
        "group relative my-3 inline-flex max-w-md no-underline outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <span className="relative block max-h-64 max-w-md overflow-hidden rounded-lg border border-border bg-muted/30 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote markdown image URLs are dynamic */}
        <img
          src={href}
          alt={label}
          title={title}
          loading="lazy"
          decoding="async"
          onError={handleError}
          className="block h-auto max-h-64 w-full max-w-md object-cover transition-opacity hover:opacity-95"
          {...rest}
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2 pb-2.5 pt-10",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        >
          <span className="rounded-full bg-background/95 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm ring-1 ring-border/60">
            Click to view full image ↗
          </span>
        </span>
      </span>
    </a>
  );
}

/**
 * Renders markdown with GFM (tables, strikethrough, task lists, autolinks)
 * and Prism-highlighted fenced code blocks (vscDarkPlus theme).
 */
export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  if (!content) return null;

  return (
    <div
      className={cn(
        // Conversation preview: tight vertical rhythm (no typography plugin —
        // prose-p:* equivalents via [&_…] so margins actually apply).
        "prose max-w-none text-sm leading-snug text-foreground",
        "prose-p:my-0 prose-p:mb-1 prose-headings:my-1 prose-ul:my-0 prose-li:my-0",
        "[&_p]:my-0 [&_p]:mb-1 [&_p]:leading-snug",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic",
        "[&_h1]:my-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:leading-snug",
        "[&_h2]:my-1 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:leading-snug",
        "[&_h3]:my-1 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:leading-snug",
        "[&_ul]:my-0 [&_ul]:list-disc [&_ul]:space-y-0 [&_ul]:pl-5",
        "[&_ol]:my-0 [&_ol]:list-decimal [&_ol]:space-y-0 [&_ol]:pl-5",
        "[&_li]:my-0 [&_li]:leading-snug [&_li]:marker:text-muted-foreground",
        "[&_blockquote]:my-1 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/40 [&_blockquote]:py-0.5 [&_blockquote]:pl-3 [&_blockquote]:pr-2 [&_blockquote]:text-muted-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_a:has(img)]:font-normal [&_a:has(img)]:no-underline",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => {
          if (url.startsWith("data:image/")) return url;
          return defaultUrlTransform(url);
        }}
        components={{
          code: MarkdownCode,
          // Avoid nested <pre> wrappers around our SyntaxHighlighter frame.
          pre: ({ children }) => <>{children}</>,
          img: MarkdownImage,
          a: ({ href, children, ...rest }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              {...rest}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
