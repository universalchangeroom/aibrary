"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side providers mounted at the root of the app.
 * Keep Server Components free of `"use client"` by isolating providers here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <TooltipProvider delayDuration={250} skipDelayDuration={150}>
        {children}
      </TooltipProvider>
    </AuthProvider>
  );
}
