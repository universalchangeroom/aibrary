import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Full-bleed Discover indigo/sunset atmosphere (same layers as the feed page).
 */
export function DiscoverBackdrop({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative min-h-[calc(100vh-3.5rem)] overflow-x-hidden bg-slate-950 text-white",
        className
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-indigo-950 via-violet-950 to-slate-950"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-blue-500/25 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute right-0 top-24 h-80 w-80 rounded-full bg-fuchsia-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-1/3 h-64 w-64 rounded-full bg-yellow-400/10 blur-3xl"
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}

/**
 * Expanded Thread Card — glassmorphic reading surface matching Discover cards.
 */
export function ExpandedThreadCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full rounded-2xl border border-white/20 bg-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.37)] backdrop-blur-md",
        "px-5 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10",
        className
      )}
    >
      {children}
    </div>
  );
}
