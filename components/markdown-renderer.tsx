"use client";

import { Check, Copy } from "lucide-react";
import { useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
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
        "max-w-none text-sm leading-relaxed text-foreground",
        "[&_p]:my-2 [&_p]:whitespace-pre-wrap",
        "[&_strong]:font-semibold [&_strong]:text-foreground",
        "[&_em]:italic",
        "[&_h1]:mb-2 [&_h1]:mt-4 [&_h1]:text-xl [&_h1]:font-semibold",
        "[&_h2]:mb-2 [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold",
        "[&_h3]:mb-1.5 [&_h3]:mt-3 [&_h3]:text-base [&_h3]:font-semibold",
        "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5",
        "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5",
        "[&_li]:my-0.5 [&_li]:marker:text-muted-foreground",
        "[&_blockquote]:my-2 [&_blockquote]:rounded-r-md [&_blockquote]:border-l-2 [&_blockquote]:border-primary/40 [&_blockquote]:bg-muted/40 [&_blockquote]:py-1 [&_blockquote]:pl-3 [&_blockquote]:pr-2 [&_blockquote]:text-muted-foreground",
        "[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2",
        "[&_hr]:my-4 [&_hr]:border-border",
        "[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-left",
        "[&_th]:border [&_th]:border-border [&_th]:bg-muted/60 [&_th]:px-2 [&_th]:py-1.5 [&_th]:font-medium",
        "[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1.5",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code: MarkdownCode,
          // Avoid nested <pre> wrappers around our SyntaxHighlighter frame.
          pre: ({ children }) => <>{children}</>,
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
