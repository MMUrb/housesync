import type { Metadata } from "next";
import Link from "next/link";
import { HomeLogoLink } from "@/components/HomeLogoLink";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How HouseSync collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-slate-100 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-3.5">
          <HomeLogoLink logoClassName="text-lg" />
          <Link href="/" className="btn-ghost text-sm">
            ← Home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12">
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-400">Last updated: 8 June 2026</p>

        <p className="mt-6 text-[15px] leading-relaxed text-slate-600">
          HouseSync (&ldquo;we&rdquo;, &ldquo;us&rdquo;) helps housemates split bills, track chores
          and manage rent. This policy explains what personal data we collect, how we use it, and
          your rights. We&rsquo;re based in the United Kingdom and follow UK GDPR and the Data
          Protection Act 2018.
        </p>

        <div className="mt-8 space-y-8">
          <Section title="Who we are">
            <p>
              HouseSync is operated from the United Kingdom and is the controller of your personal
              data. For any privacy question or request, contact us at{" "}
              <a className="text-brand-600 underline" href="mailto:hello@housesync.co.uk">
                hello@housesync.co.uk
              </a>
              .
            </p>
          </Section>

          <Section title="What we collect">
            <p className="font-medium text-slate-700">Information you give us:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong>Account</strong> — your name, email address and a password (or, if you use
                Google sign-in, the basic profile info Google shares).
              </li>
              <li>
                <strong>Profile</strong> — a display name, an avatar colour and an optional profile
                photo.
              </li>
              <li>
                <strong>Phone number</strong> — only if you choose to add and verify one for SMS
                reminders.
              </li>
              <li>
                <strong>House content</strong> — the houses you create or join, expenses, bills,
                chores, settle-up records, receipts you upload, and messages you send in your house
                chat.
              </li>
              <li>
                <strong>Preferences</strong> — whether you want email and/or SMS reminders.
              </li>
            </ul>
            <p className="mt-3 font-medium text-slate-700">Collected automatically:</p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                Basic technical data needed to run the app (your sign-in session and standard server
                logs from our hosting provider).
              </li>
              <li>
                Anonymous usage analytics — we log page views (the page visited, the referring site
                and approximate country) using our own first-party system. This uses no cookies and
                isn&rsquo;t linked to your identity.
              </li>
            </ul>
            <p className="mt-3">
              We do <strong>not</strong> collect payment card details — HouseSync doesn&rsquo;t take
              payments.
            </p>
          </Section>

          <Section title="How we use it">
            <ul className="ml-5 list-disc space-y-1">
              <li>
                To provide the app: create/join houses, split and track expenses, manage chores,
                show balances, and power the house chat.
              </li>
              <li>To send you transactional emails and, if you opt in, SMS reminders.</li>
              <li>To keep the service secure and working, and to respond to your support requests.</li>
            </ul>
          </Section>

          <Section title="Legal bases (UK GDPR)">
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong>Contract</strong> — to provide the service you sign up for.
              </li>
              <li>
                <strong>Legitimate interests</strong> — to keep the app secure and improve it.
              </li>
              <li>
                <strong>Consent</strong> — for optional things like SMS reminders, which you can
                withdraw any time in Settings.
              </li>
            </ul>
          </Section>

          <Section title="Who can see your data">
            <p>
              <strong>Your housemates</strong> can see the shared content of houses you&rsquo;re in —
              your name, avatar, the expenses, bills and chores you add, balances, and your chat
              messages. Please don&rsquo;t put anything in a house that you wouldn&rsquo;t want your
              housemates to see.
            </p>
            <p className="mt-2">
              <strong>Your phone number and notification preferences are private</strong> — other
              housemates cannot see them.
            </p>
          </Section>

          <Section title="Service providers">
            <p>
              We use trusted providers to run HouseSync. They only process your data to provide their
              service to us:
            </p>
            <ul className="ml-5 list-disc space-y-1">
              <li>
                <strong>Supabase</strong> — database, authentication and file storage (your account,
                house data, photos and receipts).
              </li>
              <li>
                <strong>Vercel</strong> — application hosting (London region).
              </li>
              <li>
                <strong>Brevo</strong> — sending transactional emails and SMS.
              </li>
              <li>
                <strong>Google</strong> — only if you choose &ldquo;Sign in with Google&rdquo;.
              </li>
            </ul>
          </Section>

          <Section title="Cookies">
            <p>
              We use essential cookies only — to keep you signed in and to secure your session. We
              don&rsquo;t use advertising or third-party tracking cookies.
            </p>
          </Section>

          <Section title="International transfers">
            <p>
              Your data is processed by the providers above, primarily in the UK and the EU. Where a
              provider processes data outside the UK, appropriate safeguards (such as UK/EU-approved
              transfer mechanisms) apply.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              We keep your data while your account is active. You can delete your account at any time
              in <strong>Settings → Delete account</strong>, which removes your personal data from
              our systems (some records may persist briefly in backups before being overwritten). If
              you tell us why you&rsquo;re leaving, we keep that reason and any optional comment
              anonymously, with no link to you, to help us improve.
            </p>
          </Section>

          <Section title="Your rights">
            <p>
              Under UK GDPR you can access your data, correct it (edit your profile in the app),
              delete it (delete your account), object to or restrict certain processing, and request
              a copy. To exercise any right, email{" "}
              <a className="text-brand-600 underline" href="mailto:hello@housesync.co.uk">
                hello@housesync.co.uk
              </a>
              . You can also complain to the UK Information Commissioner&rsquo;s Office (ico.org.uk).
            </p>
          </Section>

          <Section title="Security">
            <p>
              Data is encrypted in transit (HTTPS). Passwords are securely hashed by our
              authentication provider — we never see or store your raw password. Access to house data
              is restricted so that only members of a house can read it.
            </p>
          </Section>

          <Section title="Children">
            <p>
              HouseSync is intended for people aged 16 and over. We don&rsquo;t knowingly collect data
              from children under 16.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              We may update this policy from time to time. We&rsquo;ll post the new version here and
              update the date above.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              Questions or requests:{" "}
              <a className="text-brand-600 underline" href="mailto:hello@housesync.co.uk">
                hello@housesync.co.uk
              </a>
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
