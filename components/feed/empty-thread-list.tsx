import Link from "next/link";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Discover / feed empty state when there are no published threads.
 * Always safe to render — does not depend on a thread array.
 */
export function EmptyThreadList({
  variant = "default",
}: {
  variant?: "default" | "discover";
}) {
  const isDiscover = variant === "discover";

  return (
    <Card
      className={
        isDiscover
          ? "border border-dashed border-orange-200 bg-white/80 text-stone-800 shadow-sm backdrop-blur-sm"
          : "border-dashed bg-muted/20 shadow-none"
      }
      aria-label="No published threads"
    >
      <CardHeader className="items-center space-y-3 pb-3 pt-12 text-center">
        <CardTitle className="text-xl font-semibold tracking-tight">
          No threads published yet.
        </CardTitle>
        <CardDescription
          className={
            isDiscover
              ? "max-w-md text-base leading-relaxed text-stone-600"
              : "max-w-md text-base leading-relaxed"
          }
        >
          Be the first to share an AI conversation with the community!
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center pb-12 pt-2">
        <Button asChild size="lg" className="gap-2">
          <Link href="/share">
            <Plus className="h-4 w-4" aria-hidden />
            Import or Paste Transcript
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
