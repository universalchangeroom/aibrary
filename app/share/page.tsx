import { Suspense } from "react";

import { ShareWorkspace } from "@/components/share/share-workspace";

export default function SharePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-6 py-12">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Importer Page</h1>
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
