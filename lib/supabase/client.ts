import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase browser client for Client Components.
 *
 * Uses @supabase/ssr's createBrowserClient (cookie-aware singleton) so
 * sessions stay aligned with middleware / server clients.
 *
 * Required env vars (see .env.example):
 * - NEXT_PUBLIC_SUPABASE_URL
 * - NEXT_PUBLIC_SUPABASE_ANON_KEY
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }

  return createBrowserClient(url, anonKey);
}
