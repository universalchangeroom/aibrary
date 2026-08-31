"use client";

import type { ReactNode } from "react";

import { AuthProvider } from "@/components/providers/auth-provider";

/**
 * Client-side providers mounted at the root of the app.
 * Keep Server Components free of `"use client"` by isolating providers here.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
