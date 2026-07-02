import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Page not found" };

// Branded 404. Replaces Next's bare default page. The body already carries the
// themed background (globals.css), so this inherits light/dark automatically.
export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-6 py-16 text-center">
      <div className="max-w-sm">
        <Logo className="mx-auto text-xl" />
        <p className="mt-10 text-6xl font-extrabold tracking-tight text-brand-600">404</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">We couldn&rsquo;t find that page</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-500">
          The link may be broken or the page may have moved. Let&rsquo;s get you back to your house.
        </p>
        <Link href="/" className="btn-primary mt-8 inline-flex px-5 py-3">
          Back to HouseSync
        </Link>
      </div>
    </div>
  );
}
