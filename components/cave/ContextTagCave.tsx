"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { Cinzel, Source_Sans_3 } from "next/font/google";

import { cn } from "@/lib/utils";

const cinzel = Cinzel({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cave-serif",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-cave-sans",
});

const CONTEXT_TAGS = [
  "universe",
  "react",
  "nextjs",
  "openai",
  "code snippets",
  "curation",
  "philosophy",
  "debugging",
  "generosification",
  "freemium",
  "props economy",
  "archive",
  "deepseek",
  "claude",
  "minimalism",
  "productivity",
  "design patterns",
  "community",
  "ethics",
  "data visualization",
  "storytelling",
  "automation",
  "api integration",
  "ui/ux",
  "frontend",
  "backend",
  "scalability",
  "documentation",
  "learning",
  "innovation",
] as const;

/** Absolute placements roughly following the cave wall contours from the concept art. */
const TAG_PLACEMENTS: Array<{
  tag: (typeof CONTEXT_TAGS)[number];
  top: string;
  left: string;
  rotate?: string;
  size?: "sm" | "md" | "lg";
}> = [
  { tag: "universe", top: "14%", left: "28%", rotate: "-4deg", size: "md" },
  { tag: "react", top: "18%", left: "46%", rotate: "3deg", size: "sm" },
  { tag: "nextjs", top: "22%", left: "61%", rotate: "-2deg", size: "md" },
  { tag: "openai", top: "27%", left: "22%", rotate: "5deg", size: "sm" },
  { tag: "code snippets", top: "26%", left: "38%", rotate: "-6deg", size: "md" },
  { tag: "curation", top: "31%", left: "55%", rotate: "2deg", size: "sm" },
  { tag: "philosophy", top: "34%", left: "71%", rotate: "-3deg", size: "md" },
  { tag: "debugging", top: "36%", left: "18%", rotate: "4deg", size: "sm" },
  { tag: "generosification", top: "39%", left: "33%", rotate: "-2deg", size: "lg" },
  { tag: "freemium", top: "41%", left: "52%", rotate: "6deg", size: "sm" },
  { tag: "props economy", top: "44%", left: "67%", rotate: "-5deg", size: "md" },
  { tag: "archive", top: "47%", left: "24%", rotate: "3deg", size: "sm" },
  { tag: "deepseek", top: "49%", left: "41%", rotate: "-4deg", size: "md" },
  { tag: "claude", top: "51%", left: "58%", rotate: "2deg", size: "sm" },
  { tag: "minimalism", top: "53%", left: "74%", rotate: "-3deg", size: "md" },
  { tag: "productivity", top: "56%", left: "16%", rotate: "5deg", size: "sm" },
  { tag: "design patterns", top: "57%", left: "34%", rotate: "-2deg", size: "md" },
  { tag: "community", top: "59%", left: "53%", rotate: "4deg", size: "sm" },
  { tag: "ethics", top: "61%", left: "69%", rotate: "-6deg", size: "sm" },
  { tag: "data visualization", top: "64%", left: "21%", rotate: "3deg", size: "md" },
  { tag: "storytelling", top: "66%", left: "42%", rotate: "-3deg", size: "sm" },
  { tag: "automation", top: "68%", left: "60%", rotate: "2deg", size: "sm" },
  { tag: "api integration", top: "29%", left: "78%", rotate: "-4deg", size: "md" },
  { tag: "ui/ux", top: "46%", left: "82%", rotate: "5deg", size: "sm" },
  { tag: "frontend", top: "55%", left: "84%", rotate: "-2deg", size: "sm" },
  { tag: "backend", top: "63%", left: "80%", rotate: "3deg", size: "sm" },
  { tag: "scalability", top: "72%", left: "28%", rotate: "-5deg", size: "md" },
  { tag: "documentation", top: "73%", left: "48%", rotate: "2deg", size: "md" },
  { tag: "learning", top: "71%", left: "72%", rotate: "-3deg", size: "sm" },
  { tag: "innovation", top: "76%", left: "58%", rotate: "4deg", size: "sm" },
];

const RUNES: Array<{ glyph: string; top: string; left: string; size: string }> = [
  { glyph: "ᚠ", top: "20%", left: "34%", size: "text-2xl" },
  { glyph: "ᛟ", top: "33%", left: "48%", size: "text-xl" },
  { glyph: "ᚨ", top: "42%", left: "63%", size: "text-3xl" },
  { glyph: "ᛉ", top: "50%", left: "29%", size: "text-xl" },
  { glyph: "ᚱ", top: "58%", left: "76%", size: "text-2xl" },
  { glyph: "ᛒ", top: "67%", left: "36%", size: "text-xl" },
  { glyph: "ᛝ", top: "24%", left: "72%", size: "text-lg" },
  { glyph: "ᚦ", top: "70%", left: "64%", size: "text-2xl" },
];

function SpiralIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M60 18c23 0 42 19 42 42s-19 42-42 42-42-19-42-42c0-16 9-30 22-37"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 34c14 0 26 12 26 26s-12 26-26 26-26-12-26-26c0-10 5-18 13-23"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M60 48c7 0 12 5 12 12s-5 12-12 12-12-5-12-12c0-4 2-8 6-10"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <circle cx="60" cy="60" r="4" fill="currentColor" />
    </svg>
  );
}

function ChatShareMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="14" r="5.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="21" cy="18" r="5.5" stroke="currentColor" strokeWidth="2" />
      <path
        d="M15.5 16.5 17 17.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ContextTagCave() {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  function handleTagClick(
    event: MouseEvent<HTMLButtonElement>,
    tag: string
  ) {
    event.preventDefault();
    event.stopPropagation();
    router.push(`/tags/${encodeURIComponent(tag)}`);
  }

  return (
    <div
      className={cn(
        cinzel.variable,
        sourceSans.variable,
        "fixed inset-0 z-[60] h-screen w-screen overflow-hidden bg-[#07101f] text-amber-100"
      )}
    >
      <Image
        src="/cave-background.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />

      {/* Cool shadow wash + warm light shafts */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950/55 via-transparent to-slate-950/70"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_75%_18%,rgba(251,191,36,0.18),transparent_42%),radial-gradient(ellipse_at_35%_8%,rgba(147,197,253,0.12),transparent_35%),radial-gradient(ellipse_at_50%_100%,rgba(15,23,42,0.55),transparent_45%)]"
      />

      {/* Dust motes in light shafts */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
        {mounted
          ? Array.from({ length: 28 }).map((_, index) => (
              <span
                key={index}
                className="absolute block rounded-full bg-amber-100/70 shadow-[0_0_6px_rgba(251,191,36,0.8)] animate-pulse"
                style={{
                  width: `${1 + (index % 3)}px`,
                  height: `${1 + (index % 3)}px`,
                  top: `${8 + ((index * 17) % 70)}%`,
                  left: `${18 + ((index * 29) % 70)}%`,
                  opacity: 0.35 + (index % 5) * 0.1,
                  animationDuration: `${2.4 + (index % 6) * 0.45}s`,
                }}
              />
            ))
          : null}
      </div>

      {/* Subtle dripping water / flicker accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[18%] top-0 h-24 w-px bg-gradient-to-b from-sky-200/0 via-sky-100/40 to-sky-200/0 opacity-60"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-[62%] top-0 h-32 w-px bg-gradient-to-b from-amber-100/0 via-amber-50/35 to-amber-100/0 opacity-50"
      />

      {/* Title block — top left */}
      <header className="absolute left-6 top-6 z-20 max-w-xl sm:left-10 sm:top-8">
        <h1
          className="font-[family-name:var(--font-cave-serif)] text-3xl font-semibold tracking-[0.04em] text-amber-200 sm:text-4xl md:text-5xl"
          style={{
            textShadow:
              "0 0 12px rgba(251,191,36,0.55), 0 0 28px rgba(245,158,11,0.35), 0 2px 8px rgba(0,0,0,0.65)",
          }}
        >
          THE CONTEXT TAG CAVE
        </h1>
        <p
          className="mt-2 font-[family-name:var(--font-cave-sans)] text-sm text-amber-50/90 sm:text-base"
          style={{
            textShadow:
              "0 0 8px rgba(251,191,36,0.35), 0 1px 4px rgba(0,0,0,0.7)",
          }}
        >
          Discover the collective threads of AI wisdom
        </p>
      </header>

      {/* Runic glyphs */}
      {RUNES.map((rune) => (
        <span
          key={`${rune.glyph}-${rune.top}-${rune.left}`}
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute z-10 select-none text-amber-300/70",
            rune.size
          )}
          style={{
            top: rune.top,
            left: rune.left,
            textShadow: "0 0 10px rgba(251,191,36,0.55)",
          }}
        >
          {rune.glyph}
        </span>
      ))}

      {/* Haphazard tag field */}
      <div className="absolute inset-0 z-20">
        {TAG_PLACEMENTS.map((placement) => (
          <button
            key={placement.tag}
            type="button"
            onClick={(event) => handleTagClick(event, placement.tag)}
            className={cn(
              "absolute whitespace-nowrap rounded-full border border-amber-300/35 bg-stone-950/55 px-3 py-1 font-[family-name:var(--font-cave-sans)] font-semibold uppercase tracking-wide text-amber-200 backdrop-blur-[2px] transition duration-200",
              "hover:border-amber-200/80 hover:bg-amber-950/40 hover:text-amber-50",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80",
              placement.size === "lg" && "text-[0.7rem] sm:text-xs md:text-sm",
              placement.size === "md" && "text-[0.65rem] sm:text-[0.7rem] md:text-xs",
              placement.size === "sm" && "text-[0.6rem] sm:text-[0.65rem] md:text-[0.7rem]"
            )}
            style={{
              top: placement.top,
              left: placement.left,
              transform: `rotate(${placement.rotate ?? "0deg"})`,
              boxShadow:
                "0 0 10px rgba(251,191,36,0.35), 0 0 22px rgba(245,158,11,0.22), inset 0 0 12px rgba(251,191,36,0.08)",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.boxShadow =
                "0 0 16px rgba(251,191,36,0.7), 0 0 34px rgba(245,158,11,0.45), inset 0 0 14px rgba(251,191,36,0.16)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.boxShadow =
                "0 0 10px rgba(251,191,36,0.35), 0 0 22px rgba(245,158,11,0.22), inset 0 0 12px rgba(251,191,36,0.08)";
            }}
          >
            {placement.tag}
          </button>
        ))}
      </div>

      {/* Pedestal MENU — bottom center */}
      <div className="absolute bottom-[7%] left-1/2 z-30 flex w-[min(18rem,70vw)] -translate-x-1/2 flex-col items-center text-center">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-controls="cave-menu-overlay"
          className="flex items-center gap-2 rounded-full p-2 text-amber-300 transition hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          style={{
            filter:
              "drop-shadow(0 0 10px rgba(251,191,36,0.55)) drop-shadow(0 0 22px rgba(245,158,11,0.35))",
          }}
          aria-label="Open cave menu"
        >
          <SpiralIcon className="h-14 w-14 sm:h-16 sm:w-16" />
        </button>

        <p
          className="mt-2 font-[family-name:var(--font-cave-serif)] text-3xl font-semibold tracking-[0.18em] text-amber-200 sm:text-4xl"
          style={{
            textShadow:
              "0 0 12px rgba(251,191,36,0.55), 0 0 24px rgba(245,158,11,0.35)",
          }}
        >
          MENU
        </p>
        <Link
          href="/feed"
          className="mt-2 font-[family-name:var(--font-cave-sans)] text-xs tracking-[0.22em] text-amber-100/90 transition hover:text-amber-50 sm:text-sm"
          style={{ textShadow: "0 0 8px rgba(251,191,36,0.4)" }}
        >
          EXIT CAVERN
        </Link>
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="mt-1 font-[family-name:var(--font-cave-sans)] text-xs tracking-[0.22em] text-amber-100/90 transition hover:text-amber-50 sm:text-sm"
          style={{ textShadow: "0 0 8px rgba(251,191,36,0.4)" }}
        >
          ACCESS DIRECTORY
        </button>
      </div>

      {/* ChatShare mark — bottom right */}
      <Link
        href="/"
        className="absolute bottom-5 right-5 z-30 flex items-center gap-2 text-amber-200/80 transition hover:text-amber-100 sm:bottom-7 sm:right-8"
        style={{
          textShadow: "0 0 8px rgba(251,191,36,0.35)",
          filter: "drop-shadow(0 0 6px rgba(251,191,36,0.25))",
        }}
      >
        <ChatShareMark className="h-6 w-6" />
        <span className="font-[family-name:var(--font-cave-serif)] text-sm tracking-wide sm:text-base">
          ChatShare
        </span>
      </Link>

      {/* Minimalist menu overlay */}
      {menuOpen ? (
        <div
          id="cave-menu-overlay"
          className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/70 p-6 backdrop-blur-sm"
          onClick={() => setMenuOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Cave menu"
            className="w-full max-w-sm rounded-2xl border border-amber-400/25 bg-stone-950/90 p-8 text-center shadow-[0_0_40px_rgba(251,191,36,0.2)]"
            onClick={(event) => event.stopPropagation()}
          >
            <p
              className="font-[family-name:var(--font-cave-serif)] text-2xl tracking-[0.2em] text-amber-200"
              style={{ textShadow: "0 0 12px rgba(251,191,36,0.45)" }}
            >
              MENU
            </p>
            <div className="mt-8 flex flex-col gap-4 font-[family-name:var(--font-cave-sans)] tracking-[0.18em]">
              <Link
                href="/feed"
                className="rounded-lg border border-amber-400/30 px-4 py-3 text-sm text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/10"
              >
                EXIT CAVERN
              </Link>
              <Link
                href="/tags/archive"
                className="rounded-lg border border-amber-400/30 px-4 py-3 text-sm text-amber-100 transition hover:border-amber-300 hover:bg-amber-500/10"
                onClick={() => setMenuOpen(false)}
              >
                ACCESS DIRECTORY
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="mt-6 text-xs tracking-[0.16em] text-stone-400 transition hover:text-amber-100"
            >
              CLOSE
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default ContextTagCave;
