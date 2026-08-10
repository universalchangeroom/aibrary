import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MessageBody {
  role?: unknown;
  content?: unknown;
}

interface PublishThreadBody {
  title?: unknown;
  content?: unknown;
  source_model?: unknown;
  source?: unknown;
  tags?: unknown;
  is_public?: unknown;
  originalUrl?: unknown;
}

function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isMessageArray(value: unknown): value is { role: "user" | "assistant" | "system"; content: string }[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const msg = item as MessageBody;
    return (
      (msg.role === "user" || msg.role === "assistant" || msg.role === "system") &&
      typeof msg.content === "string" &&
      msg.content.trim().length > 0
    );
  });
}

function sourceModelFromPayload(body: PublishThreadBody): string | null {
  if (typeof body.source_model === "string" && body.source_model.trim()) {
    return body.source_model.trim();
  }

  if (typeof body.source === "string") {
    switch (body.source) {
      case "ChatGPT":
        return "GPT-4o";
      case "Claude":
        return "Claude 3.5 Sonnet";
      case "DeepSeek":
        return "DeepSeek";
      case "Gemini":
        return "Gemini";
      case "Perplexity":
        return "Other";
      case "Pasted Text":
        return "Other";
      default:
        return body.source;
    }
  }

  return null;
}

/**
 * POST /api/threads
 * Authorization: Bearer <supabase_access_token>
 * Body: { title, content, source_model?, tags?, is_public? }
 *
 * Verifies the JWT via Supabase Auth, then inserts a public.threads row
 * owned by that user (author_id = auth user id).
 */
export async function POST(request: Request) {
  const token = getBearerToken(request);

  if (!token) {
    return NextResponse.json(
      {
        success: false,
        error: "Missing Authorization bearer token. Sign in to publish.",
      },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return NextResponse.json(
      {
        success: false,
        error: "Supabase is not configured on the server.",
      },
      { status: 500 }
    );
  }

  let body: PublishThreadBody;
  try {
    body = (await request.json()) as PublishThreadBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : "";
  const content = body.content;
  const tags = Array.isArray(body.tags)
    ? body.tags.filter((tag): tag is string => typeof tag === "string" && tag.trim().length > 0)
    : [];
  const isPublic = body.is_public !== false;
  const sourceModel = sourceModelFromPayload(body);

  if (!title) {
    return NextResponse.json(
      { success: false, error: "A thread title is required." },
      { status: 400 }
    );
  }

  if (!isMessageArray(content)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Thread content must be a non-empty array of { role, content } messages.",
      },
      { status: 400 }
    );
  }

  // Authenticate as the caller using their access token (RLS applies as that user).
  const supabase = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json(
      {
        success: false,
        error: userError?.message || "Invalid or expired access token.",
      },
      { status: 401 }
    );
  }

  // Ensure a profiles row exists (FK target for threads.author_id).
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      username: user.email?.split("@")[0] ?? null,
    },
    { onConflict: "id", ignoreDuplicates: true }
  );

  if (profileError) {
    // Non-fatal if the row already exists and upsert is restricted; try insert ignore path.
    console.warn("[api/threads] profile upsert:", profileError.message);
  }

  const { data: thread, error: insertError } = await supabase
    .from("threads")
    .insert({
      author_id: user.id,
      title,
      content,
      source_model: sourceModel,
      tags,
      is_public: isPublic,
    })
    .select("id, title, created_at")
    .single();

  if (insertError || !thread) {
    return NextResponse.json(
      {
        success: false,
        error: insertError?.message || "Failed to save thread.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      data: {
        id: thread.id,
        title: thread.title,
        created_at: thread.created_at,
        author_id: user.id,
      },
    },
    { status: 201 }
  );
}
