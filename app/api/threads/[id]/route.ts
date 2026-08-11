import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

import { createClient as createServerSupabase } from "@/lib/supabase/server";
import {
  IMAGE_REVIEW_MESSAGE,
  resolveThreadStatusForContent,
} from "@/lib/thread-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MessageBody {
  role?: unknown;
  content?: unknown;
}

interface UpdateThreadBody {
  title?: unknown;
  messages?: unknown;
  content?: unknown;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getBearerToken(request: Request): string | null {
  const header =
    request.headers.get("authorization") ?? request.headers.get("Authorization");
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

function isMessageArray(
  value: unknown
): value is { role: "user" | "assistant" | "system"; content: string }[] {
  if (!Array.isArray(value) || value.length === 0) return false;

  return value.every((item) => {
    if (!item || typeof item !== "object") return false;
    const msg = item as MessageBody;
    return (
      (msg.role === "user" ||
        msg.role === "assistant" ||
        msg.role === "system") &&
      typeof msg.content === "string" &&
      msg.content.trim().length > 0
    );
  });
}

/**
 * Authenticate the caller via:
 * 1) Authorization: Bearer <access_token> (bookmarklets / API clients), or
 * 2) Supabase cookie session from the request.
 */
async function getAuthenticatedUser(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    return {
      user: null as null,
      supabase: null as null,
      error: "Supabase is not configured on the server.",
      status: 500 as const,
    };
  }

  const token = getBearerToken(request);

  if (token) {
    const supabase = createSupabaseJsClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error || !user) {
      return {
        user: null,
        supabase: null,
        error: error?.message || "Invalid or expired access token.",
        status: 401 as const,
      };
    }

    return { user, supabase, error: null, status: 200 as const };
  }

  // Cookie-based session (supabase.auth.getUser()).
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      supabase: null,
      error: error?.message || "Not authenticated. Sign in to edit this thread.",
      status: 401 as const,
    };
  }

  return { user, supabase, error: null, status: 200 as const };
}

/**
 * PUT /api/threads/[id]
 * Body: { title: string, messages: Array<{role, content}> }
 *   (also accepts `content` as an alias for `messages`)
 *
 * Auth: current Supabase user (Bearer JWT or cookie session).
 * Authorization: thread.author_id (owner) must equal user.id; else 403.
 */
export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(context.params);
  const threadId = typeof params.id === "string" ? params.id.trim() : "";

  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json(
      { success: false, error: "A valid thread id is required." },
      { status: 400 }
    );
  }

  const auth = await getAuthenticatedUser(request);
  if (!auth.user || !auth.supabase) {
    return NextResponse.json(
      { success: false, error: auth.error || "Unauthorized." },
      { status: auth.status }
    );
  }

  const { user, supabase } = auth;

  let body: UpdateThreadBody;
  try {
    body = (await request.json()) as UpdateThreadBody;
  } catch {
    return NextResponse.json(
      { success: false, error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const title =
    typeof body.title === "string" && body.title.trim()
      ? body.title.trim()
      : null;
  const messages = body.messages ?? body.content;

  if (!title) {
    return NextResponse.json(
      { success: false, error: "A non-empty title is required." },
      { status: 400 }
    );
  }

  if (!isMessageArray(messages)) {
    return NextResponse.json(
      {
        success: false,
        error:
          "messages must be a non-empty array of { role, content } objects.",
      },
      { status: 400 }
    );
  }

  // Ownership check: fetch thread and require author_id === current user (owner).
  const { data: existing, error: fetchError } = await supabase
    .from("threads")
    .select("id, author_id")
    .eq("id", threadId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      {
        success: false,
        error: fetchError.message || "Failed to load thread.",
      },
      { status: 422 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Thread not found." },
      { status: 404 }
    );
  }

  // DB column is author_id (owner); reject if not the current user.
  if (existing.author_id !== user.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden. You can only update threads you own.",
      },
      { status: 403 }
    );
  }

  // Image Markdown → hold off public feed until admin approves.
  const status = resolveThreadStatusForContent(messages);
  const pendingReview = status === "pending_review";

  const { data: updated, error: updateError } = await supabase
    .from("threads")
    .update({
      title,
      content: messages,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .eq("author_id", user.id)
    .select(
      "id, author_id, title, content, source_model, tags, is_public, status, created_at, updated_at"
    )
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        success: false,
        error: updateError?.message || "Failed to update thread.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json(
    {
      success: true,
      ...(pendingReview ? { message: IMAGE_REVIEW_MESSAGE } : {}),
      data: {
        id: updated.id,
        author_id: updated.author_id,
        owner_id: updated.author_id,
        title: updated.title,
        messages: updated.content,
        content: updated.content,
        source_model: updated.source_model,
        tags: updated.tags,
        is_public: updated.is_public,
        status: updated.status ?? status,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    },
    { status: 200 }
  );
}

/**
 * DELETE /api/threads/[id]
 *
 * Auth: current Supabase user (Bearer JWT or cookie session via getUser()).
 * Authorization: thread.author_id (owner) must equal user.id; else 403.
 * Cascades footnotes via FK on delete.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const params = await Promise.resolve(context.params);
  const threadId = typeof params.id === "string" ? params.id.trim() : "";

  if (!threadId || !UUID_RE.test(threadId)) {
    return NextResponse.json(
      { success: false, error: "A valid thread id is required." },
      { status: 400 }
    );
  }

  const auth = await getAuthenticatedUser(request);
  if (!auth.user || !auth.supabase) {
    return NextResponse.json(
      { success: false, error: auth.error || "Unauthorized." },
      { status: auth.status }
    );
  }

  const { user, supabase } = auth;

  const { data: existing, error: fetchError } = await supabase
    .from("threads")
    .select("id, author_id")
    .eq("id", threadId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      {
        success: false,
        error: fetchError.message || "Failed to load thread.",
      },
      { status: 422 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Thread not found." },
      { status: 404 }
    );
  }

  // Owner column is author_id (not user_id).
  if (existing.author_id !== user.id) {
    return NextResponse.json(
      {
        success: false,
        error: "Forbidden. You can only delete threads you own.",
      },
      { status: 403 }
    );
  }

  const { error: deleteError } = await supabase
    .from("threads")
    .delete()
    .eq("id", threadId)
    .eq("author_id", user.id);

  if (deleteError) {
    return NextResponse.json(
      {
        success: false,
        error: deleteError.message || "Failed to delete thread.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({ success: true }, { status: 200 });
}
