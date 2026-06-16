/** @type {import('next').NextConfig} */

// The browser only ever talks programmatically to our own origin and Supabase
// (REST, realtime websockets, storage images). Brevo/Resend are server-side
// only, and the social/payment links are plain <a> navigations (not subject to
// connect-src), so this stays tight without breaking anything.
const csp = [
  "default-src 'self'",
  // 'unsafe-inline' is needed for Next's hydration + the theme bootstrap script
  // and Tailwind's inline styles; React still escapes output, so XSS risk is low.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
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
