"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ClipboardPaste, X } from "lucide-react";

import { BookmarkletCard } from "@/components/import/bookmarklet-card";
import { ImportThread } from "@/components/share/import-thread";
import { ShareForm } from "@/components/share/share-form";
import { ShareScreenshotForm } from "@/components/share/share-screenshot-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ShareTab = "import" | "paste" | "screenshot";

const SHARE_TAB_LIST_CLASS =
  "flex h-auto min-h-10 w-full flex-wrap items-stretch gap-1 bg-muted p-1 [&>button]:h-auto [&>button]:min-w-[5.5rem] [&>button]:flex-1 [&>button]:whitespace-normal [&>button]:px-2 [&>button]:py-1.5 [&>button]:text-xs sm:[&>button]:text-sm";

/**
 * Share UI with paste-hint banner for the clipboard bookmarklet flow
 * (?paste=1&source=Gemini&model=… from bookmarklet).
 */
export function ShareWorkspace() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pasteFlag = searchParams.get("paste") === "1";
  const sourceParam = searchParams.get("source")?.trim() || "";
  const modelParam = searchParams.get("model")?.trim() || "";

  const [tab, setTab] = useState<ShareTab>(pasteFlag ? "paste" : "import");
  const [showPasteBanner, setShowPasteBanner] = useState(pasteFlag);

  useEffect(() => {
    if (pasteFlag) {
      setTab("paste");
      setShowPasteBanner(true);
      try {
        sessionStorage.setItem("chatshare_expect_paste", "1");
        if (sourceParam) {
          sessionStorage.setItem("chatshare_paste_source", sourceParam);
        }
        if (modelParam) {
          sessionStorage.setItem("chatshare_paste_model", modelParam);
        } else {
          sessionStorage.removeItem("chatshare_paste_model");
        }
      } catch {
        // ignore
      }
    }
  }, [pasteFlag, sourceParam, modelParam]);

  // When user switches to Paste transcript after bookmarklet open
  function handleTabChange(value: string) {
    const next: ShareTab =
      value === "paste"
        ? "paste"
        : value === "screenshot"
          ? "screenshot"
          : "import";
    setTab(next);
    if (next === "paste" && pasteFlag) {
      setShowPasteBanner(true);
    }
  }

  function dismissBanner() {
    setShowPasteBanner(false);
    try {
      sessionStorage.removeItem("chatshare_expect_paste");
      sessionStorage.removeItem("chatshare_paste_source");
      sessionStorage.removeItem("chatshare_paste_model");
    } catch {
      // ignore
    }
    // Clean query so banner does not reappear on refresh
    const params = new URLSearchParams(searchParams.toString());
    params.delete("paste");
    params.delete("source");
    params.delete("model");
    const q = params.toString();
    router.replace(q ? `/share?${q}` : "/share");
  }

  const sourceLabel = sourceParam || "AI";
  const modelHint = modelParam ? ` (${modelParam})` : "";

  return (
    <div className="flex w-full flex-col gap-6">
      {showPasteBanner && tab === "paste" ? (
        <div
          role="status"
          className="flex items-start gap-3 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-950 shadow-sm dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-50"
        >
          <ClipboardPaste className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600 dark:text-indigo-300" />
          <p className="flex-1 leading-relaxed">
            Conversation copied from {sourceLabel}
            {modelHint}! Press{" "}
            <kbd className="rounded border border-indigo-300 bg-white/80 px-1.5 py-0.5 font-mono text-xs dark:border-indigo-700 dark:bg-indigo-900/60">
              Ctrl+V
            </kbd>{" "}
            (or{" "}
            <kbd className="rounded border border-indigo-300 bg-white/80 px-1.5 py-0.5 font-mono text-xs dark:border-indigo-700 dark:bg-indigo-900/60">
              Cmd+V
            </kbd>
            ) to paste.
          </p>
          <button
            type="button"
            onClick={dismissBanner}
            className="rounded p-1 text-indigo-700 hover:bg-indigo-100 dark:text-indigo-200 dark:hover:bg-indigo-900"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <Tabs value={tab} onValueChange={handleTabChange} className="w-full">
        <TabsList className={SHARE_TAB_LIST_CLASS}>
          <TabsTrigger value="import">Import link</TabsTrigger>
          <TabsTrigger value="paste">Paste transcript</TabsTrigger>
          <TabsTrigger value="screenshot">Screenshot</TabsTrigger>
        </TabsList>

        <TabsContent value="import" className="mt-6 space-y-6">
          <ImportThread />
          <BookmarkletCard />
        </TabsContent>

        <TabsContent value="paste" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Paste transcript</CardTitle>
              <CardDescription>
                Manually paste a conversation when you do not have a public share
                link. Bookmarklet imports land here after copying to your
                clipboard.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShareForm />
            </CardContent>
          </Card>
          <BookmarkletCard />
        </TabsContent>

        <TabsContent value="screenshot" className="mt-6 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">Upload screenshot</CardTitle>
              <CardDescription>
                Drop a mobile scrolling chat screenshot to extract turns with a
                vision model, then review and publish.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShareScreenshotForm />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
