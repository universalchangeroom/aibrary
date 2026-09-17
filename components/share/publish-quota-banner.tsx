"use client";

import { useEffect, useState } from "react";

import { getViewerPublishQuota } from "@/lib/actions/publish-quota";
import type { PublishQuotaSnapshot } from "@/lib/publish-quota";
import { cn } from "@/lib/utils";

/**
 * Shows remaining daily publishes, or an admin unlimited badge.
 */
export function PublishQuotaBanner({ className }: { className?: string }) {
  const [quota, setQuota] = useState<PublishQuotaSnapshot | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = await getViewerPublishQuota();
      if (!cancelled) setQuota(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!quota) return null;

  if (quota.isAdmin) {
    return (
      <p
        className={cn(
          "rounded-lg border border-amber-300/70 bg-amber-50/90 px-3 py-2 text-sm font-medium text-amber-950",
          className
        )}
        role="status"
      >
        Admin: Unlimited publishes
      </p>
    );
  }

  const remaining = quota.remaining ?? 0;
  const exhausted = remaining <= 0;

  return (
    <p
      className={cn(
        "rounded-lg border px-3 py-2 text-sm font-medium",
        exhausted
          ? "border-red-200 bg-red-50 text-red-800"
          : "border-stone-200 bg-stone-50 text-stone-700",
        className
      )}
      role="status"
    >
      {remaining} of {quota.limit} publishes left today
      {exhausted
        ? " — you can publish again after UTC midnight."
        : null}
    </p>
  );
}
