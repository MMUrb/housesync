import type { Metadata, Viewport } from "next";
import "./globals.css";

const siteName = "HouseSync";
const description =
  "The housemate app for bills, chores and rent. Split rent, bills, groceries and chores with your housemates in one simple place — without the awkwardness.";

export const metadata: Metadata = {
  title: {
    default: `${siteName} — Bills, chores & rent for shared houses`,
    template: `%s · ${siteName}`,
  },
  description,
  applicationName: siteName,
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: siteName,
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#6f53f5",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en-GB">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
