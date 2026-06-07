# HouseSync 🏠

**The housemate app for bills, chores and rent.** Split rent, bills, groceries and
chores with your housemates in one simple place — without the awkward money chats.

This is a mobile-first web app (installable as a PWA) built from the original
*FlatMate / HouseSync* product spec. It targets UK students, apprentices and young
professionals living in shared houses.

> **📍 Where this project lives:** `C:\Users\Rahul\Projects\housesync`
>
> It was deliberately moved **out of OneDrive**. Next.js's dev server breaks inside
> OneDrive folders (OneDrive turns files into "cloud placeholders" that Node can't
> read, causing `EINVAL: readlink` errors), and syncing `node_modules` is slow and
> error-prone. Keep Node projects in a normal local folder like this one. Your
> original idea document is untouched on the Desktop.

---

## What's in this MVP

The "real MVP" five features from the spec — all built and working:

| Feature | Status |
| --- | --- |
| Create a house & invite housemates (invite links) | ✅ |
| Add shared expenses (equal / custom / % split, receipts, categories) | ✅ |
| Balance dashboard (who owes who, what's due) | ✅ |
| Recurring bills (with reminders + one-tap "log payment") | ✅ |
| Chore rota (assign, repeat, auto-rotate, mark done) | ✅ |
| Settle up (mark as paid → confirm received) | ✅ |
| Polite payment reminder generator (copy / share) | ✅ |
| House activity timeline | ✅ |
| Email + Google sign-in | ✅ |
| Mobile-first, installable PWA | ✅ |

---

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS** for styling
- **Supabase** — Postgres database, Auth, and Storage (for receipts)
- Deployable free on **Vercel**

---

## Quick start

### 1. Prerequisites

- **Node.js 18.18+** (Node 20 or 22 recommended) — check with `node -v`
- A free **[Supabase](https://supabase.com)** account

### 2. Install dependencies

```bash
npm install
```

### 3. Create your Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**. Give it a name and a
   database password, and pick a region near you. Wait ~2 minutes for it to spin up.
2. In the dashboard, open **SQL Editor → New query**.
3. Open [`supabase/schema.sql`](./supabase/schema.sql) from this repo, copy the whole
   file, paste it into the SQL editor, and click **Run**. This creates all the tables,
   security rules (RLS), helper functions and the `receipts` storage bucket. It is safe
   to re-run later.

### 4. Add your keys

1. In Supabase: **Project Settings → API**.
2. Copy this file:

   ```bash
   cp .env.local.example .env.local
   ```

3. Fill in `.env.local`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-anon-public-key
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```

   Use the **Project URL** and the **anon / public** key (never the `service_role` key).

### 5. Run it

```bash
npm run dev
```

Open **[http://localhost:3000](http://localhost:3000)**. Create an account, create a
house, and you're off.

> If you open the app before adding your keys, you'll see a friendly setup screen instead
> of an error — that's expected.

---

## Auth notes

### Email confirmation (for easy testing)

By default, Supabase asks new users to confirm their email before they can sign in. While
testing locally you can turn this off so sign-up logs you straight in:

**Authentication → Sign In / Providers → Email → turn off "Confirm email" → Save.**

(Turn it back on before you launch to real users.)

### Google sign-in (optional)

Email/password works out of the box. To enable the **Continue with Google** button:

1. **Authentication → Sign In / Providers → Google** → enable it and paste in a Google
   OAuth Client ID + secret (from the [Google Cloud Console](https://console.cloud.google.com/)).
2. In Google Cloud, set the authorised redirect URI to:
   `https://YOUR-PROJECT-ref.supabase.co/auth/v1/callback`
3. In Supabase **Authentication → URL Configuration**, add your redirect URLs:
   - `http://localhost:3000/auth/callback`
   - your production URL, e.g. `https://your-app.vercel.app/auth/callback`

---

## Deploying to Vercel

1. Push this folder to a GitHub repo.
2. In [Vercel](https://vercel.com): **New Project → import the repo**.
3. Add the same environment variables (`NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SITE_URL` set to your Vercel URL).
4. Deploy. Then add that Vercel URL to Supabase's **URL Configuration** redirect list.

---

## Project structure

```
housesync/
├── supabase/
│   └── schema.sql            # Run this in Supabase once (tables, RLS, RPCs, storage)
├── src/
│   ├── app/
│   │   ├── page.tsx          # Public marketing landing page
│   │   ├── login/            # Sign in / create account
│   │   ├── auth/             # OAuth callback + sign-out
│   │   ├── house/            # Create house + join via invite link
│   │   └── (app)/            # Authenticated app (shared shell + bottom nav)
│   │       ├── dashboard/    # Balances, upcoming bills, chores, activity
│   │       ├── expenses/     # List + add expense (split logic)
│   │       ├── bills/        # Recurring bills + "log payment"
│   │       ├── chores/       # Chore rota
│   │       ├── housemates/   # Balances + settle up + invite
│   │       └── settings/     # Profile, house, danger zone
│   ├── components/           # UI + feature components
│   ├── lib/
│   │   ├── supabase/         # Browser + server clients, middleware
│   │   ├── data.ts           # Server-side data access (houses, members, queries)
│   │   ├── balances.ts       # "Who owes who" calculation + split maths
│   │   ├── recurrence.ts     # Date maths for bills & repeating chores
│   │   └── ...
│   └── middleware.ts         # Refreshes the auth session + route guarding
└── .env.local.example
```

## How balances work (in short)

Each expense has **splits** — one row per participant saying how much they owe the
person who paid. A split moves through `unpaid → paid → confirmed`:

- The payer marks an expense; everyone else's split starts `unpaid`.
- A debtor taps **Mark as paid** → their split becomes `paid` (awaiting confirmation).
- The payer taps **Confirm received** → `confirmed`, and the debt clears.

The dashboard nets these together so you always see a single "you owe / you're owed".

---

## Roadmap (post-MVP, from the spec)

These were intentionally left out of v1: in-app payments (Open Banking / Stripe), bank
sync, AI receipt scanning, native iOS/Android apps, deposit tracker, automatic WhatsApp
reminders, shopping list, and a house noticeboard (table already exists in the schema).

---

Built from the product spec in **`App idea.docx`** (on your Desktop, in the
`App idea` folder).
