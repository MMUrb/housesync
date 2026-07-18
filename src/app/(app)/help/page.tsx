import Link from "next/link";
import { PageTitle } from "@/components/app/PageTitle";
import { IconChevronDown } from "@/components/icons";

export const metadata = { title: "Help & FAQ" };

type QA = { q: string; a: React.ReactNode };
type Group = { title: string; items: QA[] };

const GROUPS: Group[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "How do I add my housemates?",
        a: (
          <>
            Share your house&rsquo;s invite link, you&rsquo;ll find it in{" "}
            <strong>Settings → Invite link</strong>. When a housemate opens it and signs up, they
            join your house automatically.
          </>
        ),
      },
      {
        q: "Can I be in more than one house?",
        a: (
          <>
            Yes. Create or join as many houses as you like and switch between them from the house
            name at the top-left. Each house keeps its own expenses, bills, chores and chat.
          </>
        ),
      },
      {
        q: "How do I set the currency?",
        a: (
          <>
            Open <strong>Settings → this house</strong> and pick the house currency. You can also set
            a personal &ldquo;also show amounts in&rdquo; currency that only you see, handy if you
            think in a different currency to your housemates.
          </>
        ),
      },
    ],
  },
  {
    title: "Expenses & splitting",
    items: [
      {
        q: "How do I split an expense?",
        a: (
          <>
            When you add an expense, choose how to divide it: <strong>equally</strong> between
            everyone, by <strong>custom amounts</strong>, or by <strong>percentage</strong>.
            HouseSync works out who owes what for you.
          </>
        ),
      },
      {
        q: "Can I edit or delete an expense?",
        a: (
          <>
            Yes. Tap the expense in the Expenses list to open its detail sheet, then use edit or
            delete there.
          </>
        ),
      },
      {
        q: "What are categories for?",
        a: (
          <>
            Every expense has a category (with its own emoji and colour) so your spending breakdown
            makes sense at a glance. Rename, recolour or add your own in{" "}
            <strong>Settings → Expense categories</strong>.
          </>
        ),
      },
      {
        q: "Can I attach a receipt?",
        a: (
          <>
            Yes, add a photo receipt to any expense. It&rsquo;s stored privately and only members of
            your house can view it.
          </>
        ),
      },
    ],
  },
  {
    title: "Settling up",
    items: [
      {
        q: "How does settling up work?",
        a: (
          <>
            When you&rsquo;ve paid a housemate back, mark the debt as paid. They get a nudge to
            confirm they received it, so balances only clear once both of you agree.
          </>
        ),
      },
      {
        q: "Does HouseSync move the money?",
        a: (
          <>
            No. HouseSync records who owes what and helps you chase it politely, but you pay each
            other through your usual methods. Add your Monzo, PayPal or Revolut links in{" "}
            <strong>Settings</strong> so housemates know how to pay you.
          </>
        ),
      },
      {
        q: "How do I remind someone without it being awkward?",
        a: (
          <>
            On the settle-up screen HouseSync writes a friendly reminder for you to copy or share, so
            you never have to word the money chat yourself.
          </>
        ),
      },
    ],
  },
  {
    title: "Bills & chores",
    items: [
      {
        q: "What's a recurring bill?",
        a: (
          <>
            A bill that repeats, weekly, monthly, quarterly or yearly, with a next-due date and
            reminders. When it&rsquo;s paid, one tap logs the payment and can create the matching
            expense so it&rsquo;s split automatically.
          </>
        ),
      },
      {
        q: "How do chores rotate?",
        a: (
          <>
            Give a chore a repeat schedule and HouseSync auto-assigns it to the next housemate each
            time it&rsquo;s completed, so the rota stays fair without anyone keeping track.
          </>
        ),
      },
      {
        q: "I ticked a chore off by accident.",
        a: <>No problem, open the completed chore and un-check it to put it back.</>,
      },
    ],
  },
  {
    title: "Chat, notifications & your account",
    items: [
      {
        q: "How do notifications work?",
        a: (
          <>
            Turn on push and/or email in <strong>Settings</strong>, then choose exactly what
            you&rsquo;re notified about (messages, expenses, bill requests, payments, chores, new
            housemates).
          </>
        ),
      },
      {
        q: "How do I download my data?",
        a: (
          <>
            <strong>Settings → Your data → Download</strong> gives you a full copy of your HouseSync
            data as a JSON file.
          </>
        ),
      },
      {
        q: "How do I delete my account?",
        a: (
          <>
            <strong>Settings → Delete account</strong>. This removes your personal data from our
            systems. It can&rsquo;t be undone.
          </>
        ),
      },
    ],
  },
];

export default function HelpPage() {
  return (
    <div className="space-y-6">
      <PageTitle title="Help & FAQ" />

      <p className="px-1 text-sm text-slate-500">
        Quick answers to how HouseSync works. Still stuck? We&rsquo;d love to help.
      </p>

      {GROUPS.map((group) => (
        <section key={group.title} className="space-y-2">
          <h2 className="px-1 text-sm font-semibold text-slate-900">{group.title}</h2>
          <div className="space-y-2">
            {group.items.map((item, i) => (
              <details
                key={i}
                className="card group p-0 [&::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-medium text-slate-800">
                  <span>{item.q}</span>
                  <IconChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                </summary>
                <div className="px-4 pb-4 text-sm leading-relaxed text-slate-600">{item.a}</div>
              </details>
            ))}
          </div>
        </section>
      ))}

      <div className="card flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-800">Still need a hand?</p>
          <p className="text-xs text-slate-500">Email us and we&rsquo;ll get back to you.</p>
        </div>
        <a
          href="mailto:hello@housesync.co.uk?subject=HouseSync%20help"
          className="btn-secondary shrink-0 px-3 py-2 text-sm"
        >
          Contact us
        </a>
      </div>

      <div className="flex items-center justify-center gap-2 pb-2 text-xs text-slate-400">
        <Link href="/privacy" className="transition hover:text-slate-600">
          Privacy Policy
        </Link>
        <span>·</span>
        <Link href="/terms" className="transition hover:text-slate-600">
          Terms of Use
        </Link>
      </div>
    </div>
  );
}
