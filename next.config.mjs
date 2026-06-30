/** @type {import('next').NextConfig} */

// NOTE: the Content-Security-Policy is set per-request in middleware.ts (it
// needs a fresh nonce each request so we can drop 'unsafe-inline' from
// script-src). The static headers below are the ones that don't vary.
const securityHeaders = [
  // Force HTTPS for two years across all subdomains.
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Clickjacking: the app is never meant to be framed (the native shell loads it
  // as a top-level document, not an iframe).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Switch off device APIs the app doesn't use (receipt/avatar upload uses a
  // file picker, which isn't governed by the camera directive).
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  },
];

const nextConfig = {
  reactStrictMode: true,
  // Keep tab switching snappy. By default every app screen is `force-dynamic`,
  // so navigating back to a tab refetches it from the server even if you were
  // just there. Caching a visited segment in the client router cache for a short
  // window makes "Home -> Expenses -> Home" instant. Live changes still arrive
  // through Supabase realtime, and the data refreshes after the window or on a
  // hard reload, so the staleness is only ever a few seconds on a quick revisit.
  experimental: {
    staleTimes: { dynamic: 30, static: 300 },
  },
  images: {
    remotePatterns: [
      // Allow Supabase Storage public URLs (avatars; receipts are private).
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
