/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    remotePatterns: [
      // Allow Supabase Storage public URLs (receipt photos, avatars).
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
};

export default nextConfig;
