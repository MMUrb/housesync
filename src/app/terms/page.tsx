import type { Metadata } from "next";
import Link from "next/link";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const metadata: Metadata = {
  title: "Terms of Use",
  description: "The terms that govern your use of HouseSync.",
};

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="safe-top sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <HomeLogoLink logoClassName="text-lg" />
          <Link href="/" className="btn-ghost text-sm">
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Terms of Use</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: 24 June 2026</p>

        <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
          These Terms of Use (&ldquo;Terms&rdquo;) are an agreement between you and HouseSync
          (&ldquo;we&rdquo;, &ldquo;us&rdquo;), which helps housemates split bills, track chores and
          settle up. By creating an account or using HouseSync, you agree to these Terms. If you do
          not agree, please do not use the service. We are based in the United Kingdom.
        </p>

        <div className="mt-8 space-y-8">
          <Section title="Who can use HouseSync">
            <p>
              You must be at least 16 years old to use HouseSync. By using it, you confirm that the
              information you give us is accurate and that you will keep it up to date.
            </p>
          </Section>

          <Section title="Your account">
            <p>
              You are responsible for your account and for keeping your login secure. Do not share
              your password. Tell us at{" "}
              <a className="text-brand-600 underline" href="mailto:hello@housesync.co.uk">
                hello@housesync.co.uk
              </a>{" "}
              if you think someone else has accessed your account.
            </p>
          </Section>

          <Section title="Acceptable use">
            <p>You agree not to:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>use HouseSync for anything unlawful, fraudulent or harmful;</li>
              <li>
                harass, abuse, threaten or impersonate anyone, including in your house chat;
              </li>
              <li>upload content that is illegal, offensive, or infringes someone else&rsquo;s rights;</li>
              <li>
                attempt to break, overload, scrape, or gain unauthorised access to the service or
                other people&rsquo;s data.
              </li>
            </ul>
          </Section>

          <Section title="Your content and the house chat">
            <p>
              You are responsible for the content you add, including expenses, notes, photos and
              messages in your house chat. You keep ownership of your content, and you grant us
              permission to store and display it so the service can work for you and your housemates.
            </p>
            <p>
              We can remove content or suspend access that breaks these Terms. To report abusive or
              offensive content or a user, email{" "}
              <a className="text-brand-600 underline" href="mailto:hello@housesync.co.uk">
                hello@housesync.co.uk
              </a>{" "}
              and we will review it.
            </p>
          </Section>

          <Section title="Money between housemates">
            <p>
              HouseSync is a tool for <strong>tracking</strong> shared costs. We do{" "}
              <strong>not</strong> process, hold, move or transfer money, and we are not a bank or a
              payment service. Any payment details you choose to add (such as a Monzo, PayPal or
              Revolut link) are shared with your housemates at your own discretion so
              you can settle up directly between yourselves.
            </p>
            <p>
              We are not a party to any debt, payment or arrangement between you and your housemates,
              and we are not responsible for money that is owed, paid, or not paid. Always check
              payment details before you send money.
            </p>
          </Section>

          <Section title="No financial advice">
            <p>
              HouseSync does not provide financial advice. Balances and splits are calculated from the
              information entered by you and your housemates, and are for your own reference only.
            </p>
          </Section>

          <Section title="Availability">
            <p>
              We work hard to keep HouseSync running, but we provide it &ldquo;as is&rdquo; and cannot
              guarantee it will always be available, uninterrupted or error free. We may change,
              suspend or stop features at any time.
            </p>
          </Section>

          <Section title="Our liability">
            <p>
              To the fullest extent allowed by law, we are not liable for any indirect or consequential
              loss, or for any money owed, paid or not paid between housemates. Nothing in these Terms
              limits liability that cannot be limited by law (such as for death or personal injury
              caused by our negligence, or for fraud).
            </p>
          </Section>

          <Section title="Suspending or ending your account">
            <p>
              You can delete your account at any time in <strong>Settings → Delete account</strong>.
              We may suspend or end your access if you break these Terms or use HouseSync in a way that
              could harm other people or the service.
            </p>
          </Section>

          <Section title="Changes to these Terms">
            <p>
              We may update these Terms from time to time. We will post the new version here and update
              the date above. If you keep using HouseSync after a change, you accept the updated Terms.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These Terms are governed by the laws of England and Wales, and any disputes are subject to
              the courts of England and Wales.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions about these Terms:{" "}
              <a className="text-brand-600 underline" href="mailto:hello@housesync.co.uk">
                hello@housesync.co.uk
              </a>
              . See also our{" "}
              <Link href="/privacy" className="text-brand-600 underline">
                Privacy Policy
              </Link>
              .
            </p>
          </Section>
        </div>
      </main>

      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto max-w-3xl px-5 text-center text-sm text-slate-400">
          <Link href="/" className="hover:text-slate-600">
            HouseSync
          </Link>{" "}
          · © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-slate-900">{title}</h2>
      <div className="mt-2 space-y-2 text-[15px] leading-relaxed text-slate-600">{children}</div>
    </section>
  );
}
