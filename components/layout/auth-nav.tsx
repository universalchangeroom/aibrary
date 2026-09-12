"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  HelpCircle,
  Loader2,
  LogOut,
  NotebookText,
  Shield,
  Star,
  Settings,
} from "lucide-react";

import { PropsExplainerModal } from "@/components/props-explainer-modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { isAdminEmail } from "@/lib/admin";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

/** Text-only monogram from permanent username — never an image. */
function usernameMonogram(username: string | null | undefined): string {
  const cleaned = username?.trim().replace(/^@+/, "") ?? "";
  if (!cleaned) return "?";
  return cleaned.slice(0, Math.min(2, cleaned.length)).toUpperCase();
}

function MonogramBadge({
  label,
  className,
}: {
  label: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-muted font-bold tabular-nums text-foreground",
        className
      )}
      aria-hidden
    >
      {label}
    </span>
  );
}

export function AuthNav({
  tokenBalance = null,
  className,
}: {
  tokenBalance?: number | null;
  className?: string;
}) {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [propsExplainerOpen, setPropsExplainerOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!user) {
      setUsername(null);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    void (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (cancelled) return;

      const next =
        typeof data?.username === "string" ? data.username.trim() : "";
      setUsername(next || null);
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleSignOut() {
    setIsSigningOut(true);
    setMenuOpen(false);
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/");
      router.refresh();
    } finally {
      setIsSigningOut(false);
    }
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <Button size="sm" variant="outline" disabled>
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading
        </Button>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={cn("flex items-center gap-4", className)}>
        <Button asChild size="sm" variant="outline">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    );
  }

  const handle = username?.replace(/^@+/, "") ?? null;
  const monogram = usernameMonogram(handle);
  const showPropsBalance = typeof tokenBalance === "number";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {showPropsBalance ? (
        <div className="inline-flex items-center gap-1.5">
          <span
            className="inline-flex items-center rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium tabular-nums text-muted-foreground"
            aria-label={`${tokenBalance} Props`}
          >
            {tokenBalance} 🎉
          </span>
          <button
            type="button"
            onClick={() => setPropsExplainerOpen(true)}
            className="rounded-full p-0.5 text-stone-400 transition-colors hover:text-stone-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="How Props work"
          >
            <HelpCircle className="h-4 w-4" aria-hidden />
          </button>
          <PropsExplainerModal
            isOpen={propsExplainerOpen}
            onClose={() => setPropsExplainerOpen(false)}
          />
        </div>
      ) : null}

      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2 pl-1.5"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          aria-label={
            handle ? `Account menu for @${handle}` : "Account menu"
          }
          onClick={() => setMenuOpen((open) => !open)}
        >
          <MonogramBadge label={monogram} className="h-6 w-6 text-[10px]" />
          <span className="hidden max-w-[10rem] truncate sm:inline">
            {handle ? `@${handle}` : "Set username"}
          </span>
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 text-muted-foreground transition-transform",
              menuOpen && "rotate-180"
            )}
          />
        </Button>

        {menuOpen ? (
          <div
            role="menu"
            className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
          >
            <div className="flex items-center gap-2 border-b px-2 py-2">
              <MonogramBadge
                label={monogram}
                className="h-8 w-8 text-xs"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {handle ? `@${handle}` : "Set username"}
                </p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </div>
            </div>
            {isAdminEmail(user.email) ? (
              <>
                <Link
                  href="/admin/reports"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  <Shield className="h-4 w-4" />
                  Reports
                </Link>
                <Link
                  href="/admin/moderation"
                  role="menuitem"
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setMenuOpen(false)}
                >
                  <Shield className="h-4 w-4" />
                  Moderation
                </Link>
              </>
            ) : null}
            <Link
              href={`/user/${encodeURIComponent(user.id)}`}
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setMenuOpen(false)}
            >
              <NotebookText className="h-4 w-4" />
              My Portfolio
            </Link>
            <Link
              href="/dashboard/starred"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setMenuOpen(false)}
            >
              <Star className="h-4 w-4" />
              Starred
            </Link>
            <Link
              href="/settings"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
              onClick={() => setMenuOpen(false)}
            >
              <Settings className="h-4 w-4" />
              Settings
            </Link>
            <button
              type="button"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50"
              disabled={isSigningOut}
              onClick={handleSignOut}
            >
              {isSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Sign Out
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
