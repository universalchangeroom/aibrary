/** Neon-green frowning Mr. Slop — no hazard frame, carousel-native. */
export function MrSlopFace({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle
        cx="32"
        cy="32"
        r="28"
        fill="#39FF14"
        fillOpacity="0.92"
        className="drop-shadow-[0_0_10px_rgba(57,255,20,0.75)]"
      />
      <circle cx="32" cy="32" r="28" stroke="#86EFAC" strokeWidth="2" />
      <path
        d="M16 22c4-3 8-3 12 0"
        stroke="#052e16"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M36 22c4-3 8-3 12 0"
        stroke="#052e16"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22" cy="28" r="3.2" fill="#052e16" />
      <circle cx="42" cy="28" r="3.2" fill="#052e16" />
      <path
        d="M20 44c4-8 20-8 24 0"
        stroke="#052e16"
        strokeWidth="3.5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** @deprecated Prefer `HandMeter`. */
export { HandMeter as PropsVsSlopMeter } from "@/components/HandMeter";
