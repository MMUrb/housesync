import type { Metadata } from "next";
import { headers } from "next/headers";
import { Logo } from "@/components/Logo";
import { FollowUs } from "@/components/SocialLinks";
import { WaitlistForm } from "@/components/waitlist/WaitlistForm";

export const metadata: Metadata = {
  title: "Join the waitlist · HouseSync",
  description: "HouseSync is launching soon. Join the waitlist for early access.",
  robots: { index: false, follow: false },
};

export default async function WaitlistPage() {
  // Set by middleware when the gate rewrote another path to this page; the
  // unlock flow sends the visitor back there. Internal paths only.
  const requested = (await headers()).get("x-gate-requested-path") ?? "/";
  const returnTo = requested.startsWith("/") && !requested.startsWith("//") ? requested : "/";
  return (
    <main className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-white px-5 py-12">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 to-white dark:hidden" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo className="text-2xl" />
        </div>

        <div className="card p-6 sm:p-8">
          <span className="chip bg-brand-100 text-brand-700">Launching soon 🚀</span>
          <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Join the waitlist
          </h1>
          <p className="mt-2 text-slate-600">
            HouseSync is almost ready: the easiest way for UK housemates to split bills, track
            chores and stay on top of rent. Drop your email and we&apos;ll let you know the moment
            it&apos;s live, plus updates along the way.
          </p>

          <WaitlistForm returnTo={returnTo} />
        </div>

        <div className="mt-6">
          <FollowUs />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          HouseSync · stop arguing about house bills
        </p>
      </div>
    </main>
  );
}
