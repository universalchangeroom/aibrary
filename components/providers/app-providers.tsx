"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/providers/auth-provider";
import { ReaderTabsProvider } from "@/components/reader/reader-tabs-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side providers mounted at the root of the app.
 * Keep Server Components free of `"use client"` by isolating providers here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ReaderTabsProvider>
        <TooltipProvider delayDuration={250} skipDelayDuration={150}>
          {children}
        </TooltipProvider>
      </ReaderTabsProvider>
    </AuthProvider>
  );
}
