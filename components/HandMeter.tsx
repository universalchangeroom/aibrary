"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";

export type HandMeterPhase = 1 | 2;

export interface HandMeterAngleResult {
  angle: number;
  phase: HandMeterPhase;
  totalVotes: number;
}

/**
 * Two-phase Props vs Slop hand rotation.
 *
 * Phase 1 (first 10 votes, or until ±90°): Prop +10°, Slop −10°.
 * Phase 2 (after 10 votes or ±90° hit): Prop +1°, Slop −1°.
 *
 * Vote order is reconstructed by interleaving remaining props/slops
 * (preferring the side with more remaining) so the angle is deterministic
 * from public counts alone.
 */
export function computeHandMeterAngle(
  propsCount: number,
  slopCount: number
): HandMeterAngleResult {
  let propsLeft = Math.max(0, Math.floor(propsCount));
  let slopLeft = Math.max(0, Math.floor(slopCount));
  let angle = 0;
  let totalProcessed = 0;
  let phase: HandMeterPhase = 1;

  while (propsLeft > 0 || slopLeft > 0) {
    const takeProp =
      propsLeft > 0 && (propsLeft >= slopLeft || slopLeft === 0);

    if (phase === 1) {
      if (takeProp) {
        angle += 10;
        propsLeft -= 1;
      } else {
        angle -= 10;
        slopLeft -= 1;
      }
      totalProcessed += 1;
      angle = Math.max(-90, Math.min(90, angle));
      if (totalProcessed >= 10 || angle === 90 || angle === -90) {
        phase = 2;
      }
    } else {
      if (takeProp) {
        angle += 1;
        propsLeft -= 1;
      } else {
        angle -= 1;
        slopLeft -= 1;
      }
    }
  }

  return {
    angle,
    phase: totalProcessed < 10 && Math.abs(angle) < 90 ? 1 : phase,
    totalVotes: Math.max(0, Math.floor(propsCount)) + Math.max(0, Math.floor(slopCount)),
  };
}

/** Outlined hand; at 0° the thumb points left so +CSS rotation = thumbs up. */
function HandOutline({
  stroke,
  glow,
}: {
  stroke: string;
  glow: string | undefined;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="h-full w-full"
      style={
        glow
          ? { filter: `drop-shadow(0 0 6px ${glow}) drop-shadow(0 0 14px ${glow})` }
          : undefined
      }
    >
      {/* Palm + fingers (thumb extends left / west at rest) */}
      <path
        d="M38 50c-7 1-14-2-17-8-2-4-2-9 0-13l3-7c1-2 3-3 5-2 1 0 2 2 2 3v6
           c0-6 1-14 2-18 1-3 3-4 5-4s4 2 4 5v14
           c0-5 1-11 3-14 1-2 3-3 5-3s4 2 4 5v12
           c0-4 1-8 3-10 1-2 3-3 5-2s3 3 3 5v11
           c0-3 1-5 3-6 2-1 4 0 5 2 1 2 1 5 0 8l-4 12c-3 8-10 13-18 14z"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      {/* Thumb — horizontal left at rotate(0) */}
      <path
        d="M24 28c-5-1-10 1-13 5-2 3-2 7 0 9 2 3 6 4 10 3 3-1 6-3 8-6"
        stroke={stroke}
        strokeWidth="2.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export interface HandMeterProps {
  propsCount: number;
  slopCount: number;
  className?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Rotating hand meter for Props vs Slop.
 * +angle → thumbs up (Props), −angle → thumbs down (Slop).
 */
export function HandMeter({
  propsCount,
  slopCount,
  className,
  size = "md",
}: HandMeterProps) {
  const { angle, phase, totalVotes } = useMemo(
    () => computeHandMeterAngle(propsCount, slopCount),
    [propsCount, slopCount]
  );

  const warm = angle > 30;
  const toxic = angle < -30;
  const stroke = warm ? "#fbbf24" : toxic ? "#39FF14" : "#9ca3af";
  const glow = warm
    ? "rgba(251,191,36,0.75)"
    : toxic
      ? "rgba(57,255,20,0.7)"
      : undefined;

  const box =
    size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11";

  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center",
        box,
        className
      )}
      role="img"
      aria-label={`Hand meter ${angle > 0 ? "thumbs up" : angle < 0 ? "thumbs down" : "neutral"} at ${angle} degrees. Props ${Math.max(0, propsCount)}, Slop ${Math.max(0, slopCount)}, phase ${phase}.`}
      title={`Hand ${angle > 0 ? "+" : ""}${angle}° · Props ${propsCount} · Slop ${slopCount}${totalVotes === 0 ? "" : ` · P${phase}`}`}
    >
      <div
        className="h-full w-full will-change-transform"
        style={{
          transform: `rotate(${angle}deg)`,
          transition:
            "transform 600ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        <HandOutline stroke={stroke} glow={glow} />
      </div>
    </div>
  );
}

export default HandMeter;
