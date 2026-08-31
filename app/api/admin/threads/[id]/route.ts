import { NextResponse } from "next/server";

import { isAdminEmail } from "@/lib/admin";
import { createServiceClient } from "@/lib/supabase/admin";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      ok: false as const,
      status: 401 as const,
      error: "Sign in required.",
      user: null,
    };
  }

  if (!isAdminEmail(user.email)) {
    return {
      ok: false as const,
      status: 403 as const,
      error: "Forbidden. Admin access only.",
      user: null,
    };
  }

  return { ok: true as const, status: 200 as const, error: null, user };
}

/**
 * PATCH /api/admin/threads/[id]
 * Body (optional): { action?: "approve" | "reject" }
 * Default action: approve → status = published
 * Reject → delete the thread (and related footnotes via cascade).
 */
export async function PATCH(
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

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  let action: "approve" | "reject" = "approve";
  try {
    const body = (await request.json().catch(() => ({}))) as {
      action?: unknown;
    };
    if (body.action === "reject") action = "reject";
    else if (body.action === "approve" || body.action == null) {
      action = "approve";
    } else {
      return NextResponse.json(
        { success: false, error: 'action must be "approve" or "reject".' },
        { status: 400 }
      );
    }
  } catch {
    action = "approve";
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Service role client is not configured.",
      },
      { status: 500 }
    );
  }

  const { data: existing, error: fetchError } = await admin
    .from("threads")
    .select("id, status, title")
    .eq("id", threadId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 422 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Thread not found." },
      { status: 404 }
    );
  }

  if (action === "reject") {
    const { error: deleteError } = await admin
      .from("threads")
      .delete()
      .eq("id", threadId);

    if (deleteError) {
      return NextResponse.json(
        { success: false, error: deleteError.message },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Thread rejected and deleted.",
      data: { id: threadId, action: "reject" },
    });
  }

  if (existing.status !== "pending_review" && existing.status !== "published") {
    // Still allow forcing publish of pending/edge rows.
  }

  const { data: updated, error: updateError } = await admin
    .from("threads")
    .update({
      status: "published",
      is_public: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", threadId)
    .select("id, title, status, is_public, updated_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json(
      {
        success: false,
        error: updateError?.message || "Failed to publish thread.",
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Thread approved and published.",
    data: updated,
  });
}

/**
 * DELETE /api/admin/threads/[id]
 * Reject / remove a pending thread from the database.
 */
export async function DELETE(
  _request: Request,
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

  const auth = await requireAdmin();
  if (!auth.ok) {
    return NextResponse.json(
      { success: false, error: auth.error },
      { status: auth.status }
    );
  }

  let admin;
  try {
    admin = createServiceClient();
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Service role client is not configured.",
      },
      { status: 500 }
    );
  }

  const { data: existing, error: fetchError } = await admin
    .from("threads")
    .select("id")
    .eq("id", threadId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json(
      { success: false, error: fetchError.message },
      { status: 422 }
    );
  }

  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Thread not found." },
      { status: 404 }
    );
  }

  const { error: deleteError } = await admin
    .from("threads")
    .delete()
    .eq("id", threadId);

  if (deleteError) {
    return NextResponse.json(
      { success: false, error: deleteError.message },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    message: "Thread rejected and deleted.",
    data: { id: threadId },
  });
}
