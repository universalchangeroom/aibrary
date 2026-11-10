"use client";

import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
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
  const [showMountain, setShowMountain] = useState(false);
  const [portalReady, setPortalReady] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

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

  // Clear the easter egg if the pointer is released anywhere (incl. outside the logo).
  useEffect(() => {
    if (!showMountain) return;

    function hideMountain() {
      setShowMountain(false);
    }

    window.addEventListener("pointerup", hideMountain);
    window.addEventListener("pointercancel", hideMountain);
    window.addEventListener("blur", hideMountain);
    return () => {
      window.removeEventListener("pointerup", hideMountain);
      window.removeEventListener("pointercancel", hideMountain);
      window.removeEventListener("blur", hideMountain);
    };
  }, [showMountain]);

  function beginMountainHold(event: ReactPointerEvent<HTMLElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setShowMountain(true);
  }

  const mountainOverlay =
    showMountain && portalReady
      ? createPortal(
          <div
            className="pointer-events-none fixed inset-0 z-[9999] flex items-center justify-center bg-black/95 p-6"
            role="presentation"
            aria-hidden
          >
            <div className="relative h-[min(90vh,56rem)] w-[min(90vw,56rem)]">
              <Image
                src="/mountain-logo.jpg"
                alt="ChatShare mountain logo"
                fill
                priority
                sizes="90vw"
                className="object-contain"
                draggable={false}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center px-6">
        <nav className="flex items-center gap-6 text-sm">
          <div className="group flex items-center gap-2">
            <Link
              href="/"
              aria-label="ChatShare home"
              className="shrink-0"
            >
              <Image
                src="/logo.png"
                alt=""
                width={36}
                height={36}
                priority
                draggable={false}
                onPointerDown={beginMountainHold}
                onPointerUp={() => setShowMountain(false)}
                onPointerCancel={() => setShowMountain(false)}
                onContextMenu={(event) => event.preventDefault()}
                className="h-9 w-9 touch-none select-none rounded-xl object-cover [-webkit-touch-callout:none]"
              />
            </Link>
            <span
              role="button"
              tabIndex={0}
              aria-label="Show ChatShare mountain logo"
              onPointerDown={beginMountainHold}
              onPointerUp={() => setShowMountain(false)}
              onPointerCancel={() => setShowMountain(false)}
              onContextMenu={(event) => event.preventDefault()}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setShowMountain(true);
                }
              }}
              onKeyUp={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setShowMountain(false);
                }
              }}
              className="cursor-pointer touch-none select-none bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-lg font-bold tracking-tight text-transparent [-webkit-touch-callout:none]"
            >
              ChatShare
            </span>
          </div>
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

      {mountainOverlay}
    </header>
  );
}
