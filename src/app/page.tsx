import Link from "next/link";
import { Logo } from "@/components/Logo";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      {/* Nav */}
      <header className="safe-top sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5">
          <HomeLogoLink logoClassName="text-lg" />
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden whitespace-nowrap text-sm btn-ghost sm:inline-flex">
              Sign in
            </Link>
            <Link href="/login" className="whitespace-nowrap text-sm btn-primary">
              <span className="sm:hidden">Get started</span>
              <span className="hidden sm:inline">Create your house</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-brand-50 to-white dark:hidden" />
        <div className="relative mx-auto grid max-w-5xl items-center gap-10 px-5 py-16 md:grid-cols-2 md:py-24">
          <div>
            <span className="chip bg-brand-100 text-brand-700">For UK shared houses 🇬🇧</span>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Stop arguing about house bills.
            </h1>
            <p className="mt-4 max-w-md text-lg text-slate-600">
              HouseSync helps housemates split rent, bills, groceries and chores in one simple place
              — without the awkward money chats.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/login" className="btn-primary px-5 py-3 text-base">
                Create your house
              </Link>
              <Link href="/login" className="btn-secondary px-5 py-3 text-base">
                Join with invite link
              </Link>
            </div>
            <p className="mt-3 text-sm text-slate-400">Free for your whole house. No card needed.</p>
          </div>

          {/* Mock dashboard */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="card overflow-hidden p-5 shadow-soft">
              <p className="text-sm font-semibold text-slate-900">Manchester Flat</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-red-50 p-3">
                  <p className="text-xs text-red-500">You owe</p>
                  <p className="text-xl font-bold text-red-600">£42.50</p>
                </div>
                <div className="rounded-xl bg-mint-50 p-3">
                  <p className="text-xs text-mint-600">You&apos;re owed</p>
                  <p className="text-xl font-bold text-mint-600">£18.00</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <MockRow emoji="💡" title="Wi-Fi bill" meta="Due in 3 days" amount="£32.99" />
                <MockRow emoji="🧹" title="Kitchen clean" meta="Rahul · tomorrow" />
                <MockRow emoji="🛒" title="Big shop" meta="Adam paid" amount="£54.20" />
              </div>
            </div>
            <div className="absolute -right-3 -top-3 hidden rotate-3 rounded-xl bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-soft sm:block">
              All square 🎉
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <div className="rounded-3xl bg-slate-900 p-8 text-white sm:p-12">
          <h2 className="text-2xl font-bold sm:text-3xl">
            Shared houses run on messy group chats and forgotten transfers.
          </h2>
          <p className="mt-3 max-w-2xl text-slate-300">
            Someone&apos;s always chasing everyone else. HouseSync keeps it all clear:
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {[
              "Who paid for what",
              "Who owes who",
              "What bills are due soon",
              "What chores need doing",
              "What's already been settled",
              "A full house timeline",
            ].map((t) => (
              <li key={t} className="flex items-center gap-2 text-slate-100">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-[11px]">
                  ✓
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Up and running in two minutes
        </h2>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          <Step n="1" title="Create your house" text="Name it, set the rent day, and get a shareable invite link." />
          <Step n="2" title="Invite your housemates" text="Everyone joins from their own phone and adds expenses." />
          <Step n="3" title="Split, track & settle" text="Bills, chores and balances stay clear for the whole house." />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-center text-2xl font-bold text-slate-900 sm:text-3xl">
          Everything your shared house needs
        </h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Feature emoji="🧾" title="Split bills" text="Add rent, Wi-Fi, energy, water and groceries. Split equally, by amount or by %." />
          <Feature emoji="🔁" title="Recurring bills" text="Set monthly bills once. We remind the house and split each payment." />
          <Feature emoji="🧹" title="Chore rota" text="Assign cleaning, bins and tasks. Repeating chores rotate automatically." />
          <Feature emoji="💬" title="Polite reminders" text="Generate a friendly nudge to copy into WhatsApp — no awkward messages." />
          <Feature emoji="📊" title="One clear dashboard" text="See what you owe, what you're owed and what's due at a glance." />
          <Feature emoji="🕓" title="House timeline" text="A transparent record of every expense, payment and completed chore." />
        </div>
      </section>

      {/* Who it's for */}
      <section className="mx-auto max-w-5xl px-5 py-10">
        <div className="rounded-3xl border border-brand-100 bg-brand-50 p-8 text-center sm:p-12">
          <h2 className="text-2xl font-bold text-slate-900">Built for shared living</h2>
          <p className="mx-auto mt-3 max-w-2xl text-slate-600">
            Made for UK students, apprentices and young professionals sharing a house or flat —
            focused on real house living, not just splitting a holiday.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-5 py-16 text-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
          Less awkward money chats. Fewer house arguments.
        </h2>
        <div className="mt-7 flex justify-center">
          <Link href="/login" className="btn-primary px-6 py-3 text-base">
            Create your house — it&apos;s free
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 text-sm text-slate-400">
          <Logo className="text-base text-slate-500" />
          <p>The housemate app for bills, chores and rent.</p>
          <div className="flex items-center gap-2">
            <a
              href="https://www.instagram.com/housesync.uk/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="HouseSync on Instagram"
              className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
            >
              <InstagramIcon />
            </a>
            <a
              href="https://www.tiktok.com/@housesync.uk"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="HouseSync on TikTok"
              className="grid h-9 w-9 place-items-center rounded-full text-slate-400 transition hover:bg-brand-50 hover:text-brand-600"
            >
              <TikTokIcon />
            </a>
          </div>
          <p className="text-xs text-slate-300">
            © {new Date().getFullYear()} HouseSync ·{" "}
            <Link href="/privacy" className="transition hover:text-slate-500">
              Privacy
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function MockRow({
  emoji,
  title,
  meta,
  amount,
}: {
  emoji: string;
  title: string;
  meta: string;
  amount?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-2.5">
      <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100">{emoji}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{title}</p>
        <p className="text-xs text-slate-400">{meta}</p>
      </div>
      {amount && <span className="text-sm font-semibold text-slate-700">{amount}</span>}
    </div>
  );
}

function Step({ n, title, text }: { n: string; title: string; text: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-brand-600 text-lg font-bold text-white">
        {n}
      </div>
      <h3 className="mt-4 font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
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

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="3.8" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M16.6 5.82a4.3 4.3 0 0 1-1.05-2.82h-3.2v12.6a2.57 2.57 0 1 1-2.57-2.57c.27 0 .53.04.78.12V9.9a5.78 5.78 0 1 0 5 5.72V9.01a7.43 7.43 0 0 0 4.33 1.39V7.2a4.3 4.3 0 0 1-3.29-1.38z" />
    </svg>
  );
}
