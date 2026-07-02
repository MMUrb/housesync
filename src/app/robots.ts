import type { MetadataRoute } from "next";

// Marketing pages are crawlable; the signed-in app, the admin console and API
// routes are not (they're private and/or useless in search results).
export default function robots(): MetadataRoute.Robots {
  const base = "https://housesync.co.uk";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/hq-k4p9",
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
