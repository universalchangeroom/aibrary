"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type FormattedTimeProps = {
  date: string;
  className?: string;
};

function formatLocalDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Locale date/time that hydrates cleanly: server and the first client paint
 * render the same empty label, then the local timezone string mounts in useEffect.
 */
export function FormattedTime({ date, className }: FormattedTimeProps) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    setLabel(formatLocalDate(date));
  }, [date]);

  if (!date) return null;

  return (
    <time dateTime={date} suppressHydrationWarning className={cn(className)}>
      {label}
    </time>
  );
}
