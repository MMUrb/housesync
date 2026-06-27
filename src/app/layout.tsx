import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Analytics } from "@/components/Analytics";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeWatcher } from "@/components/ThemeWatcher";
import { ErrorReporter } from "@/components/ErrorReporter";
import { ServiceWorker } from "@/components/ServiceWorker";

const siteName = "HouseSync";
const description =
  "The housemate app for bills, chores and rent. Split rent, bills, groceries and chores with your housemates in one simple place, without the awkwardness.";

const tagline = `${siteName} · stop arguing about house bills`;

export const metadata: Metadata = {
  metadataBase: new URL("https://housesync.co.uk"),
  title: {
    default: `${siteName}: Bills, chores & rent for shared houses`,
    template: `%s · ${siteName}`,
  },
  description,
  applicationName: siteName,
  keywords: [
    "split rent",
    "split bills",
    "housemate app",
    "flatmate app",
    "shared house",
    "chore rota",
    "house expenses",
    "settle up",
    "student house",
    "roommate",
    "split groceries",
    "house bills UK",
  ],
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
  openGraph: {
    type: "website",
    siteName,
    title: tagline,
    description,
    url: "https://housesync.co.uk",
    locale: "en_GB",
    images: [
      {
        url: "/og.png",
        width: 1200,
        height: 630,
        alt: "HouseSync: split rent, bills & chores with your housemates",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: tagline,
    description,
    images: ["/og.png"],
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
    <html lang="en-GB" suppressHydrationWarning>
      <body className="min-h-dvh antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme:dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`,
          }}
        />
        {children}
        <Analytics />
        <SpeedInsights />
        <ThemeWatcher />
        <ErrorReporter />
        <ServiceWorker />
      </body>
    </html>
  );
}
