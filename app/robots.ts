import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || "https://chatshare.co"
  ).replace(/\/+$/, "");

  return {
    rules: [
      {
        userAgent: ["Googlebot", "Bingbot"],
        allow: ["/", "/feed"],
        disallow: ["/api/", "/share"],
      },
      {
        userAgent: [
          "GPTBot",
          "CCBot",
          "Bytespider",
          "anthropic-ai",
          "Claude-Web",
        ],
        disallow: "/",
      },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/share"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
