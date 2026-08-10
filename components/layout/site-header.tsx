import Link from "next/link";

import { AuthNav } from "@/components/layout/auth-nav";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-6">
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/" className="font-semibold tracking-tight">
            ChatShare
          </Link>
          <Link
            href="/feed"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Discover
          </Link>
        </nav>

        <AuthNav />
      </div>
    </header>
  );
}
