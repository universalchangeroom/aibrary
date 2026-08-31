import Link from "next/link";
import { Share2 } from "lucide-react";
import { unstable_noStore as noStore } from "next/cache";

import { AuthNav } from "@/components/layout/auth-nav";
import { Button } from "@/components/ui/button";
import { ensureViewerPropsBalance } from "@/lib/props-balance";
import { createClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  // Props balance must never be served from a static/RSC data cache.
  noStore();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let tokenBalance: number | null = null;
  if (user?.id) {
    const ensured = await ensureViewerPropsBalance(supabase, user.id);
    tokenBalance = ensured.balance;
  }

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
          {user ? (
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

        {/* key forces AuthNav to remount when balance changes after router.refresh() */}
        <AuthNav
          key={
            typeof tokenBalance === "number"
              ? `props-${tokenBalance}`
              : "props-unknown"
          }
          tokenBalance={tokenBalance}
          className="ml-auto"
        />
      </div>
    </header>
  );
}
