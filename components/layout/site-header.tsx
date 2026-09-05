"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Share2 } from "lucide-react";

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
          <Link href="/" className="font-semibold tracking-tight">
            ChatShare
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
              <Link href="/share">
                <Share2 className="h-4 w-4" />
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
