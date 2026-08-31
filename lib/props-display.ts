/** 🥳 per 10 Props, 🎉 per remaining single Prop (e.g. 83 → 8×🥳 + 3×🎉). */
export function propsToEmojiString(total: number): string {
  return propsToEmojiArray(total).join("");
}

export function propsToEmojiArray(total: number): string[] {
  const count = Math.max(0, Math.floor(total));
  const tens = Math.floor(count / 10);
  const ones = count % 10;
  return [
    ...Array.from({ length: tens }, () => "🥳"),
    ...Array.from({ length: ones }, () => "🎉"),
  ];
}

export function normalizePropsTotal(total: unknown): number {
  return typeof total === "number" && Number.isFinite(total)
    ? Math.max(0, Math.floor(total))
    : 0;
}
