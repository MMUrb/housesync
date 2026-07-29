import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HomeLogoLink } from "@/components/HomeLogoLink";
import { ThemeIconButton } from "@/components/ThemeIconButton";

export const metadata = {
  title: "For landlords",
  description:
    "Your tenants already run their house on HouseSync. The landlord dashboard adds maintenance in one queue, announcements that land, and every document in its place.",
};

// Placeholder until the real Calendly event link exists — swap this one
// constant and every CTA on the page updates.
const BOOK_CALL_URL = "https://calendly.com";
const CONTACT_EMAIL = "hello@housesync.co.uk";

export default function LandlordsPage() {
  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <header className="safe-top sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <HomeLogoLink logoClassName="text-lg" />
          <div className="flex items-center gap-2">
            <ThemeIconButton />
            <Link href="/login" className="hidden whitespace-nowrap text-sm btn-ghost sm:inline-flex">
              Sign in
            </Link>
            <a
              href={BOOK_CALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="whitespace-nowrap text-sm btn-primary"
            >
              Book a call
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 to-white dark:hidden" />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="chip bg-brand-100 text-brand-700">
              For HMO landlords &amp; letting agents
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Your tenants already run their house here. Now plug in.
            </h1>
            <p className="mt-4 max-w-md text-lg text-slate-600">
              Housemates use HouseSync free to sort bills, chores and their shared house. The
              landlord dashboard adds the part you need: maintenance in one queue, announcements
              that actually land, and every document in its place.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href={BOOK_CALL_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary px-5 py-3 text-base"
              >
                Book a 15-minute call
              </a>
              <a href={`mailto:${CONTACT_EMAIL}`} className="btn-secondary px-5 py-3 text-base">
                {CONTACT_EMAIL}
              </a>
            </div>
            <p className="mt-3 text-sm text-slate-400">Tenants never pay.</p>
          </div>

          {/* Mock landlord dashboard */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="card overflow-hidden p-5 shadow-soft">
              <p className="text-sm font-semibold text-slate-900">Your properties</p>
              <div className="mt-3 space-y-2">
                <PropertyRow
                  emoji="🏠"
                  name="14 Mill Road"
                  meta="4 tenants · tenancy ends 30/09/2026"
                  pill="2 open issues"
                  pillClass="bg-red-50 text-red-600"
                />
                <PropertyRow
                  emoji="🏡"
                  name="7 Cross Street"
                  meta="5 tenants · tenancy ends 31/08/2026"
                  pill="All clear"
                  pillClass="bg-mint-50 text-mint-600"
                />
                <PropertyRow
                  emoji="🏘️"
                  name="22 Fallowfield Ave"
                  meta="3 tenants · gas cert due in 54 days"
                  pill="1 reminder"
                  pillClass="bg-amber-50 text-amber-600"
                />
              </div>
              <div className="mt-3 flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-50">📷</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">
                    Boiler not heating water
                  </p>
                  <p className="text-xs text-slate-400">14 Mill Road · reported by Maya · 2h ago</p>
                </div>
                <span className="chip shrink-0 bg-amber-50 text-amber-600">Booked</span>
              </div>
            </div>
            <div className="absolute -right-3 -top-3 hidden rotate-3 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-soft sm:block">
              All issues in one queue 📋
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Five tenants, five WhatsApps, zero record.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Issues arrive by text, call, email and group chat, then vanish. The landlord dashboard
            gives every shared house one channel, with a timestamped trail you can rely on if a
            deposit dispute ever happens.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Maintenance reports with photos, urgency and status",
              "Housemates see the ticket too, so no duplicate reports",
              "Announcements pushed to the right house's noticeboard",
              "Tenancy agreements, gas certs and EPCs where tenants find them",
              "Compliance reminders before anything expires",
              "Every property, tenancy and open issue on one screen",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-slate-100">
                <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-500 text-[11px]">
                  ✓
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* What you get */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">What you get</h2>
        <p className="mt-3 text-center text-slate-500">
          The tenant app stays free forever. You pay for the layer on top.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Feature
            emoji="🔧"
            title="Maintenance queue"
            text="Every issue across your properties in one list. Update the status, reply to the tenant, keep the photo trail."
          />
          <Feature
            emoji="📣"
            title="Announcements"
            text='"Gas engineer coming Tuesday" posted once, delivered to the right house with a push notification.'
          />
          <Feature
            emoji="🗂️"
            title="Documents & compliance"
            text="Certificates and agreements per house, with automatic reminders before gas certs, EICRs and licences expire."
          />
        </div>
      </section>

      {/* Privacy promise */}
      <section className="mx-auto max-w-5xl px-5 py-6">
        <div className="flex items-start gap-4 rounded-3xl border border-mint-100 bg-mint-50 p-6 sm:items-center sm:p-8">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-mint-100 text-xl">
            🔒
          </span>
          <div>
            <p className="font-semibold text-slate-900">Tenants&apos; private life stays private.</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              You see reported issues and your own announcements. Never their chat, money splits or
              shopping list. That trust is why tenants actually use it, and why your maintenance
              channel works.
            </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">How it works</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <Step
            n="1"
            title="Book a 15-minute call"
            text="Tell us about your properties. We'll show you the dashboard on the call."
          />
          <Step
            n="2"
            title="We set you up"
            text="Your houses added and tenants invited for you as part of the pilot."
          />
          <Step
            n="3"
            title="Keep it if it works"
            text="One simple per-property price after the pilot. No contract, cancel anytime."
          />
        </div>

        {/* Pricing (no number until pilots set it) */}
        <div className="card mx-auto mt-10 max-w-xl p-8 text-center">
          <span className="chip bg-mint-50 text-mint-600">Simple pricing</span>
          <p className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            One simple price per property, per month
          </p>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
            A per-property price we agree together at the end of your pilot. Unlimited tenants,
            issues and announcements. Tenants pay nothing, ever.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 pb-16">
        <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-brand-700 p-10 text-center text-white sm:p-12">
          <h2 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
            Managing shared houses shouldn&apos;t live in your texts.
          </h2>
          <p className="mt-3 text-brand-100">
            Join the pilot and get your properties set up personally.
          </p>
          <div className="mt-7 flex justify-center">
            <a
              href={BOOK_CALL_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center rounded-2xl bg-white px-6 py-3 text-base font-semibold text-brand-700 shadow-soft transition hover:bg-brand-50"
            >
              Book a 15-minute call
            </a>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 text-sm text-slate-400">
          <Logo className="text-base text-slate-500" />
          <p>The landlord layer on top of the housemate app.</p>
          <p className="text-xs text-slate-300">
            © {new Date().getFullYear()} HouseSync ·{" "}
            <Link href="/" className="transition hover:text-slate-500">
              Home
            </Link>{" "}
            ·{" "}
            <Link href="/privacy" className="transition hover:text-slate-500">
              Privacy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function PropertyRow({
  emoji,
  name,
  meta,
  pill,
  pillClass,
}: {
  emoji: string;
  name: string;
  meta: string;
  pill: string;
  pillClass: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-100">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{name}</p>
        <p className="text-xs text-slate-400">{meta}</p>
      </div>
      <span className={`chip shrink-0 ${pillClass}`}>{pill}</span>
    </div>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <div className="card p-5">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-2xl">{emoji}</div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="card p-5">
      <div className="grid h-9 w-9 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white">
        {n}
      </div>
      <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}
