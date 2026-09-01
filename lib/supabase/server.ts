import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Next.js patches global fetch and may Data-Cache GET responses.
 * Supabase PostgREST SELECTs are GETs — without no-store, header balance
 * can stay stuck on the first read after giveProps + revalidatePath.
 */
function fetchNoStore(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  return fetch(input, { ...init, cache: "no-store" });
}

/**
 * Supabase client for Server Components, Server Actions, and Route
 * Handlers. A new client must be created for every request, because it
 * reads the auth session from the request cookies.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        fetch: fetchNoStore,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
