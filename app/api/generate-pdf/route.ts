import { NextResponse } from "next/server";
import puppeteer from "puppeteer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Puppeteer + Chromium can exceed the default serverless timeout. */
export const maxDuration = 60;

const PDF_STYLES = `
  @page {
    margin: 16mm;
  }
  html, body {
    margin: 0;
    padding: 0;
    background: #ffffff;
    color: #111827;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
      "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    padding: 0;
  }
  * {
    box-sizing: border-box;
  }
  h1, h2, h3, h4, h5, h6 {
    margin: 1.1em 0 0.45em;
    line-height: 1.25;
    font-weight: 650;
    page-break-after: avoid;
  }
  p, li, blockquote {
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  p {
    margin: 0.65em 0;
  }
  ul, ol {
    margin: 0.65em 0;
    padding-left: 1.4em;
  }
  pre, code {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    font-size: 0.9em;
    overflow-wrap: anywhere;
    word-break: break-word;
  }
  pre {
    white-space: pre-wrap;
    padding: 0.75em 1em;
    border-radius: 6px;
    background: #f3f4f6;
    page-break-inside: avoid;
  }
  img, table {
    max-width: 100%;
  }
  a {
    color: #1d4ed8;
    text-decoration: underline;
  }
`;

type GeneratePdfBody = {
  htmlContent?: unknown;
  title?: unknown;
};

function sanitizeFilename(title: string): string {
  const base = title
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .slice(0, 120)
    .trim();
  const safe = base || "chatshare-export";
  return safe.toLowerCase().endsWith(".pdf") ? safe : `${safe}.pdf`;
}

function wrapHtmlDocument(htmlContent: string): string {
  const trimmed = htmlContent.trim();
  const looksComplete =
    /^<!DOCTYPE/i.test(trimmed) || /^<html[\s>]/i.test(trimmed);

  if (looksComplete) {
    // Inject styles into existing documents so print CSS still applies.
    if (/<\/head>/i.test(trimmed)) {
      return trimmed.replace(
        /<\/head>/i,
        `<style>${PDF_STYLES}</style></head>`
      );
    }
    return `<!DOCTYPE html><html><head><meta charset="utf-8" /><style>${PDF_STYLES}</style></head><body>${trimmed}</body></html>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <style>${PDF_STYLES}</style>
  </head>
  <body>${trimmed}</body>
</html>`;
}

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

  try {
    let body: GeneratePdfBody;
    try {
      body = (await request.json()) as GeneratePdfBody;
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body." },
        { status: 400 }
      );
    }

    const htmlContent =
      typeof body.htmlContent === "string" ? body.htmlContent : null;
    const title = typeof body.title === "string" ? body.title : "ChatShare Export";

    if (!htmlContent || !htmlContent.trim()) {
      return NextResponse.json(
        { error: "htmlContent is required." },
        { status: 400 }
      );
    }

    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    });

    const page = await browser.newPage();
    await page.setContent(wrapHtmlDocument(htmlContent), {
      waitUntil: "networkidle0",
    });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
    });

    await browser.close();
    browser = null;

    const filename = sanitizeFilename(title);
    // RFC 5987 filename* for non-ASCII titles; ASCII filename as fallback.
    const asciiFilename = filename.replace(/[^\x20-\x7E]/g, "_");
    const disposition = `attachment; filename="${asciiFilename.replace(/"/g, "")}"; filename*=UTF-8''${encodeURIComponent(filename)}`;

    return new Response(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": disposition,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/generate-pdf]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to generate PDF.",
      },
      { status: 500 }
    );
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        // ignore close errors
      }
    }
  }
}
