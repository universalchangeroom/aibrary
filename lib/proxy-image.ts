/**
 * Client helpers for loading remote AI images that block hotlinking / referrers.
 */

export function isProxyableImageUrl(src: string): boolean {
  const value = String(src || "").trim();
  if (!value) return false;
  if (value.startsWith("data:") || value.startsWith("blob:")) return false;
  if (value.includes("/api/proxy-image")) return false;
  return /^https?:\/\//i.test(value);
}

export function proxiedImageUrl(src: string): string {
  return `/api/proxy-image?url=${encodeURIComponent(String(src || "").trim())}`;
}
