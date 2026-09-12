"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";

import { AuthNav } from "@/components/layout/auth-nav";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { getViewerPropsBalance } from "@/lib/actions/props";

/**
 * Site chrome. Auth + Props balance load on the client so pages like Discover
 * can use Incremental Static Regeneration without cookies() in the layout.
 */
export function SiteHeader() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();
  const [tokenBalance, setTokenBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!user) {
      setTokenBalance(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const balance = await getViewerPropsBalance();
        if (!cancelled) setTokenBalance(balance);
      } catch {
        if (!cancelled) setTokenBalance(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
        <nav className="flex items-center gap-6 text-sm">
          <Link
            href="/"
            className="group flex items-center gap-2"
            aria-label="ChatShare home"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="url(#amberGradient)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-8 w-8 drop-shadow-[0_0_8px_rgba(245,158,11,0.8)]"
              aria-hidden="true"
            >
              <defs>
                <linearGradient
                  id="amberGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#fcd34d" />
                  <stop offset="50%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
              <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12c0 2.13.666 4.104 1.8 5.72M8 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0zM12 8v.01" />
              <path d="M15.5 12a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z" />
            </svg>
            <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-lg font-bold tracking-tight text-transparent">
              ChatShare
            </span>
          </Link>
          <Link
            href="/feed"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Discover
          </Link>
          {!isLoading && user ? (
            <Button
              asChild
              size="sm"
              className="border-transparent bg-green-600 text-white hover:bg-green-700"
            >
              <Link href="/share" className="flex items-center gap-1.5">
                <Plus className="h-4 w-4" aria-hidden />
                Share one!
              </Link>
            </Button>
          ) : null}
        </nav>

        <AuthNav
          key={
            typeof tokenBalance === "number"
              ? `props-${tokenBalance}`
              : user
                ? "props-loading"
                : "props-signed-out"
          }
          tokenBalance={tokenBalance}
          className="ml-auto"
        />
      </div>
    </header>
  );
}
