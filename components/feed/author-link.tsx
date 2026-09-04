"use client";

import Link from "next/link";

import {
  authorDisplayName,
  authorPortfolioHref,
  type AuthorProfile,
} from "@/lib/author-profile";
import { cn } from "@/lib/utils";

interface AuthorLinkProps {
  author?: AuthorProfile | null;
  authorId?: string | null;
  className?: string;
  /** When true, show a leading @ for named handles (not Anonymous). */
  showAt?: boolean;
}

export function AuthorLink({
  author,
  authorId,
  className,
  showAt = true,
}: AuthorLinkProps) {
  const label = authorDisplayName(author ?? (authorId ? { id: authorId, username: null } : null));
  const href = authorPortfolioHref(author, authorId);
  const display =
    showAt && label !== "Anonymous" ? `@${label}` : label;

  if (!href) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>
        {display}
      </span>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium text-stone-700 underline-offset-2 hover:underline",
        className
      )}
      onClick={(event) => {
        // Avoid navigating the parent thread card link when nested in feed cards.
        event.stopPropagation();
      }}
    >
      {display}
    </Link>
  );
}
