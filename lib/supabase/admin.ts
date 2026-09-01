import { createClient } from "@supabase/supabase-js";

/**
 * Next.js may Data-Cache GET responses from the patched global fetch.
 * Service-role reads/writes must always hit the live database.
 */
function fetchNoStore(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

/**
 * Privileged Supabase client (service role). Server-only.
 * Bypasses RLS so admins can list pending threads and look up author emails.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (never expose to the browser).
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Admin operations require NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(url, serviceKey, {
    global: {
      fetch: fetchNoStore,
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
