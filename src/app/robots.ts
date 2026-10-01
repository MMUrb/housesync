import type { MetadataRoute } from "next";

// Marketing pages are crawlable; the signed-in app and API routes are not
// (they're private and/or useless in search results). The admin console is
// deliberately NOT listed: this file is public, and naming it here would
// advertise its address. Its pages are noindex and gated anyway.
export default function robots(): MetadataRoute.Robots {
  const base = "https://housesync.co.uk";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/dashboard",
        "/expenses",
        "/bills",
        "/chores",
        "/housemates",
        "/settings",
        "/chat",
        "/house/",
        "/api/",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
