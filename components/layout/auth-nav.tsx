"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Loader2,
  LogOut,
  NotebookText,
  Shield,
  Star,
  Settings,
  UserRound,
} from "lucide-react";

import { AuthModal } from "@/components/auth/auth-modal";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { isAdminEmail } from "@/lib/admin";
import { cn } from "@/lib/utils";

function userInitials(email: string | undefined): string {
  if (!email) return "?";
  const local = email.split("@")[0] ?? email;
  return local.slice(0, 2).toUpperCase();
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
  const [authOpen, setAuthOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
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

  async function handleSignOut() {
    setIsSigningOut(true);
    setMenuOpen(false);
    try {
      const { createClient } = await import("@/lib/supabase/client");
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => setAuthOpen(true)}
        >
          Sign In
        </Button>
        <AuthModal open={authOpen} onOpenChange={setAuthOpen} />
      </div>
    );
  }

  const email = user.email ?? "Account";
  const showPropsBalance = typeof tokenBalance === "number";

  return (
    <div className={cn("flex items-center gap-4", className)}>
      {showPropsBalance ? (
        <span
          className="inline-flex items-center rounded-md border bg-muted/40 px-2.5 py-1.5 text-xs font-medium tabular-nums text-muted-foreground"
          aria-label={`${tokenBalance} Props`}
        >
          {tokenBalance} 🎉
        </span>
      ) : null}

      <div className="relative" ref={menuRef}>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="gap-2 pl-1.5"
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
            aria-hidden
          >
            {userInitials(user.email)}
          </span>
          <span className="hidden max-w-[10rem] truncate sm:inline">
            {email}
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
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <UserRound className="h-4 w-4 text-muted-foreground" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{email}</p>
                <p className="text-xs text-muted-foreground">Signed in</p>
              </div>
            </div>
            {isAdminEmail(user.email) ? (
              <Link
                href="/admin/moderation"
                role="menuitem"
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                onClick={() => setMenuOpen(false)}
              >
                <Shield className="h-4 w-4" />
                Moderation
              </Link>
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
