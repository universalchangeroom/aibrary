import { Suspense } from "react";

import { ShareWorkspace } from "@/components/share/share-workspace";

export default function SharePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Share a Chat</h1>
        <p className="text-muted-foreground">
          Import a public share link, paste a raw transcript, or upload a mobile
          chat screenshot, then publish to the ChatShare feed.
        </p>
      </header>

      <Suspense
        fallback={
          <p className="text-sm text-muted-foreground">Loading share tools…</p>
        }
      >
        <ShareWorkspace />
      </Suspense>
    </main>
  );
}
