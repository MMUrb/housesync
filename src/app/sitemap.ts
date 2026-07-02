import type { MetadataRoute } from "next";

// Public, indexable marketing routes only. The app itself is private (see
// robots.ts), so it's deliberately absent here.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://housesync.co.uk";
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/login`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
