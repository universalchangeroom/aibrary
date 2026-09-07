"use client";

import { Check, ChevronDown, Copy, ImageIcon } from "lucide-react";
import {
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";
import remarkGfm from "remark-gfm";

import { Button } from "@/components/ui/button";
import {
  isProxyableImageUrl,
  proxiedImageUrl,
} from "@/lib/proxy-image";
import { splitThoughtProcess } from "@/lib/thought-process";
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

type AnchorProps = ComponentPropsWithoutRef<"a"> & {
  node?: unknown;
};

function languageFromClassName(className?: string): string {
  const match = /language-([\w#+-]+)/.exec(className ?? "");
  return match?.[1] ?? "text";
}

/** Flatten react-markdown children into plain text for link-label checks. */
function childrenToPlainText(children: ReactNode): string {
  if (children == null || typeof children === "boolean") return "";
  if (typeof children === "string" || typeof children === "number") {
    return String(children);
  }
  if (Array.isArray(children)) {
    return children.map(childrenToPlainText).join("");
  }
  return "";
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
 * Google CDN assets often need referrerPolicy=no-referrer; on failure we retry
 * via `/api/proxy-image`.
 */
function MarkdownImage({ src, alt, title, className, ...rest }: ImgProps) {
  const href = typeof src === "string" ? src.trim() : "";
  const label = (alt || title || "Image").trim() || "Image";
  const [displaySrc, setDisplaySrc] = useState(href);
  const [usedProxy, setUsedProxy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setDisplaySrc(href);
    setUsedProxy(false);
    setFailed(false);
  }, [href]);

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
          "my-2 inline-flex max-h-36 w-auto flex-col items-center justify-center gap-1 rounded-md border border-dashed border-stone-200 bg-muted/40 px-3 py-6 text-muted-foreground shadow-sm",
          className
        )}
      >
        <ImageIcon className="h-5 w-5 shrink-0 opacity-70" aria-hidden />
        <span className="max-w-[9rem] px-1 text-center text-[10px] font-medium leading-tight">
          Original image unavailable
        </span>
      </span>
    );
  }

  function handleError() {
    if (!usedProxy && isProxyableImageUrl(href)) {
      setUsedProxy(true);
      setDisplaySrc(proxiedImageUrl(href));
      return;
    }
    setFailed(true);
  }

  const openHref =
    usedProxy && isProxyableImageUrl(href) ? proxiedImageUrl(href) : href;

  return (
    <a
      href={openHref}
      target="_blank"
      rel="noopener noreferrer"
      title={title || "Click to view full image ↗"}
      className={cn(
        "group relative my-2 inline-block max-w-fit no-underline outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className
      )}
    >
      <span className="relative inline-block max-h-36 overflow-hidden rounded-md border border-stone-200 bg-muted/20 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element -- remote markdown image URLs are dynamic */}
        <img
          {...rest}
          src={displaySrc}
          alt={label}
          title={title || "Click to view full image ↗"}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={handleError}
          className="block h-auto max-h-36 w-auto object-cover transition-opacity hover:opacity-95"
        />
        <span
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-black/70 via-black/30 to-transparent px-1.5 pb-1.5 pt-6",
            "opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
          )}
        >
          <span className="rounded bg-background/95 px-1.5 py-0.5 text-[10px] font-medium text-foreground shadow-sm ring-1 ring-border/60">
            View full ↗
          </span>
        </span>
      </span>
    </a>
  );
}

/**
 * Bookmarklet video pseudo-links: `[AI Generated Video](https://…)` → compact player.
 * All other anchors keep default new-tab link behavior.
 */
function MarkdownAnchor({ href, children, className, ...rest }: AnchorProps) {
  const linkText = childrenToPlainText(children);
  const isAiVideo = linkText.includes("AI Generated Video");
  const src = typeof href === "string" ? href.trim() : "";

  if (isAiVideo && src && /^https?:\/\//i.test(src)) {
    return (
      <div
        className={cn(
          "ai-video-block my-2 overflow-hidden rounded-md border border-amber-900/20 bg-stone-900/5 shadow-sm",
          className
        )}
      >
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="ai-video-player max-h-40 w-full rounded-md bg-black object-contain"
        >
          <a
            href={src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-700 underline hover:text-amber-900"
          >
            AI Generated Video
          </a>
        </video>
        {/* Screen: hidden. PDF/print stylesheet reveals this and hides <video>. */}
        <div
          className="ai-video-print-placeholder hidden border border-dashed border-amber-900/30 bg-amber-50/80 px-3 py-2.5 text-sm text-stone-800 print:block"
          data-video-url={src}
        >
          <p className="m-0 font-medium leading-snug">
            🎥 [AI Generated Video: view online to play]
          </p>
          <p className="m-0 mt-1 break-all text-xs text-stone-600">{src}</p>
        </div>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "font-medium text-amber-700 underline underline-offset-2 hover:text-amber-900",
        className
      )}
      {...rest}
    >
      {children}
    </a>
  );
}

const proseClassName = cn(
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
  "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5"
);

function MarkdownDocument({ content }: { content: string }) {
  if (!content) return null;

  return (
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
        a: MarkdownAnchor,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}

function ThoughtProcessBlock({ content }: { content: string }) {
  return (
    <details
      open
      className="group/thought mb-3 rounded-md border border-border/70 bg-muted/30"
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2",
          "text-xs font-medium text-muted-foreground",
          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
          "[&::-webkit-details-marker]:hidden"
        )}
      >
        <span>Thought Process</span>
        <ChevronDown
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-open/thought:rotate-180"
          aria-hidden
        />
      </summary>
      <div
        className={cn(
          proseClassName,
          "border-t border-border/60 px-3 py-2.5",
          "border-l-2 border-l-muted-foreground/35 text-[0.8125rem] leading-snug text-muted-foreground",
          "[&_strong]:text-muted-foreground [&_a]:text-muted-foreground"
        )}
      >
        <MarkdownDocument content={content} />
      </div>
    </details>
  );
}

/**
 * Renders markdown with GFM (tables, strikethrough, task lists, autolinks)
 * and Prism-highlighted fenced code blocks (vscDarkPlus theme).
 * Leading <think>…</think> blocks render in a distinct Thought Process panel.
 */
export function MarkdownRenderer({
  content,
  className,
}: MarkdownRendererProps) {
  if (!content) return null;

  const { thought, body } = splitThoughtProcess(content);

  return (
    <div className={cn(proseClassName, className)}>
      {thought ? <ThoughtProcessBlock content={thought} /> : null}
      {body ? <MarkdownDocument content={body} /> : null}
    </div>
  );
}
