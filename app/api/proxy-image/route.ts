import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

function isPrivateHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal")
  ) {
    return true;
  }
  // IPv4 literals
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  // IPv6 locals
  if (host === "::1" || host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80")) {
    return true;
  }
  return false;
}

function isAllowedImageUrl(raw: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (isPrivateHostname(parsed.hostname)) return null;
  return parsed;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url")?.trim() ?? "";
  if (!target) {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }

  const parsed = isAllowedImageUrl(target);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid or disallowed url" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const upstream = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
        // Empty / omitted Referer helps Googleusercontent hotlink checks.
        "User-Agent":
          "Mozilla/5.0 (compatible; ChatShareImageProxy/1.0; +https://chatshare.ca)",
      },
      // Node fetch: do not send a Referer from our origin.
      referrerPolicy: "no-referrer",
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream ${upstream.status}` },
        { status: 502 }
      );
    }

    const contentType = (
      upstream.headers.get("content-type") || "application/octet-stream"
    ).split(";")[0]!.trim();
    if (
      contentType &&
      !contentType.startsWith("image/") &&
      contentType !== "application/octet-stream"
    ) {
      return NextResponse.json(
        { error: "Upstream response is not an image" },
        { status: 502 }
      );
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    if (!buffer.byteLength) {
      return NextResponse.json({ error: "Empty image" }, { status: 502 });
    }
    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Image too large" }, { status: 413 });
    }

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType.startsWith("image/")
          ? contentType
          : "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=86400",
        "Content-Length": String(buffer.byteLength),
      },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch image" }, { status: 502 });
  } finally {
    clearTimeout(timer);
  }
}
