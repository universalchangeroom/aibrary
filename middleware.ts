import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

const SCRAPER_USER_AGENT_RE =
  /curl|wget|python-requests|aiohttp|scrapy|httpclient|postmanruntime|headlesschrome|phantomjs/i;

export async function middleware(request: NextRequest) {
  const userAgent = request.headers.get("user-agent")?.trim() ?? "";

  if (SCRAPER_USER_AGENT_RE.test(userAgent)) {
    return NextResponse.json(
      { error: "Automated access is restricted." },
      { status: 403 }
    );
  }

  const { pathname } = request.nextUrl;
  const isProtectedPage =
    pathname === "/feed" ||
    pathname.startsWith("/feed/") ||
    pathname === "/thread" ||
    pathname.startsWith("/thread/");
  const acceptsHtml =
    request.headers.get("accept")?.includes("text/html") ?? false;
  const isDocumentNavigation =
    request.method === "GET" &&
    (request.headers.get("sec-fetch-dest") === "document" || acceptsHtml);
  const acceptLanguage =
    request.headers.get("accept-language")?.trim() ?? "";

  if (
    isProtectedPage &&
    isDocumentNavigation &&
    (!userAgent || !acceptLanguage)
  ) {
    return NextResponse.json(
      { error: "Browser request headers are incomplete." },
      { status: 400 }
    );
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/auth|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
