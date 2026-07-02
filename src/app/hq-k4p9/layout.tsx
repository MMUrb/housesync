import type { Metadata } from "next";

// Admin console: never indexable. Passthrough layout (the root layout still
// provides <html>/<body>); this only attaches the noindex metadata.
export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
