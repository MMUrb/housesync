# HouseSync — Product Requirements Document

**Status:** Living document, reflects the product as shipped.
**Last updated:** 30 June 2026.
**One-liner:** The housemate app for bills, chores and rent. Split shared costs and run a shared house without the awkward money chats.

> This PRD is reverse-documented from the live product, so the "Built" sections describe what actually ships today, not aspirations. The "Future / not yet built" section is clearly separated.

---

## 1. Problem and audience

People in shared houses juggle rent, bills, the weekly shop and chores across group chats, spreadsheets and memory. It is fiddly, it creates resentment ("who paid for what?"), and chasing housemates for money is socially awkward.

**Target users:** UK students, apprentices and young professionals in shared houses (typically 2 to 6 people). Mobile-first, price-sensitive, already living in their phones.

**Value proposition:** one simple place for who-owes-who, what is due, and whose turn it is, with the awkward bits (payment chasing) softened by the product.

---

## 2. Goals and non-goals

**Goals**
- Make splitting and settling shared costs effortless and unambiguous.
- Keep recurring obligations (rent, bills, chores) visible and fairly rotated.
- Reduce the social friction of money between housemates.
- Work great on a phone, installable as an app, with no app-store friction to start (PWA) and a native presence (Play Store, App Store) to follow.

**Non-goals (deliberately out of scope for now)**
- Acting as a payment processor or moving real money. The app records and nudges; people pay each other through their existing methods.
- Full personal-finance / budgeting beyond the shared-house context.
- Landlord / property-management features.

---

## 3. Personas

- **The organiser.** Sets up the house, adds bills, nudges people. Wants control and clarity.
- **The casual housemate.** Just wants to know what they owe and tick chores off. Wants low effort.
- **The new mover-in.** Joins via an invite link, needs to get oriented fast.

---

## 4. Built feature set

All of the following are implemented and live.

### 4.1 Accounts and onboarding
- Email/password and Google sign-in.
- Email verification, forgot/reset password flows.
- Waitlist with unlock mechanic (for staged launch).
- Account deletion, with feedback capture on why people leave.

### 4.2 Houses
- Create a house; join another via invite link.
- Belong to multiple houses and switch between them from the header.
- Per-house members, roles and settings (name, currency, rent day).

### 4.3 Expenses and balances
- Add a shared expense with equal, custom-amount, or percentage splits.
- Custom, per-house expense categories (with emoji and colour), editable.
- Receipts attached to expenses, stored in a private bucket (signed, short-lived view URLs).
- Balance dashboard: who owes whom and how much.
- Expenses list with Ongoing / Settled tabs and a category filter.

### 4.4 Settle up
- Mark a debt as paid, the other person confirms received.
- Polite payment-reminder generator (copy / share text).
- Stored payment details / handles so people know how to pay each other.

### 4.5 Bills (recurring)
- Recurring bills (weekly / monthly / quarterly / yearly) with a next-due date.
- Reminders, and a one-tap "log payment" that can create the matching expense.

### 4.6 Chores
- Assign chores, set repeat (weekly / fortnightly / monthly), auto-rotate to the next housemate on completion.
- Upcoming / Completed tabs; recurring chores move the completed instance to Completed while the next occurrence stays in Upcoming.
- Timescale filter on Upcoming (Today / This week / This month / All) to zoom in and out, with overdue items always in scope.

### 4.7 House chat
- Real-time house chat with emoji.
- Unread system: a count badge on the Chat tab (capped "9+") that clears reliably once read, and per-house unread badges in the house switcher that clear on read and update live.

### 4.8 Spending insights
- Monthly budget target with progress.
- Trend explorer: scope by you / a person / the whole house, over week / month / custom ranges, with an auto-generated insight and category breakdown.

### 4.9 Activity and notifications
- House activity timeline.
- Web push notifications with per-type preferences; transactional email (welcome, waitlist, verify, reminders) via Resend.

### 4.10 Platform and presentation
- Mobile-first, installable PWA, with light and dark themes.
- Native wrapper via Capacitor for Google Play and the App Store (iPhone-targeted iOS build).
- Service worker caches the static app shell for fast launches (never user data).

### 4.11 Admin (internal, gated route)
- Overview, users, churn report, waitlist management.
- Error log with client/server capture, click-through detail (stack, user agent, etc.), Current / Resolved tabs, and a verify-before-resolve flow that confirms an error has actually stopped recurring before it can be marked resolved.

---

## 5. Data model (high level)

Backed by Supabase Postgres with row-level security on every table. Core tables include:

- `profiles` — user profile, avatar, payment handles.
- `houses`, plus membership and per-house settings (currency, rent day, monthly budget).
- `house_categories` — per-house expense categories.
- `expenses`, `expense_splits` — costs and how they are divided; split status drives settle-up.
- `bills` — recurring obligations, linked to expenses when logged.
- `chores` — one row per occurrence; completing a recurring chore spawns the next.
- `messages`, `message_reads` — chat and per-user/per-house read state.
- `activity` — the house timeline feed.
- `push_subscriptions`, push type/email preferences.
- `waitlist` / unlocks, deletion feedback/context.
- `error_logs` — admin error tooling.
- `rate_limits` — Postgres-backed rate limiting.

---

## 6. Non-functional requirements

### 6.1 Stack
- **Frontend/server:** Next.js (App Router) on Vercel (serverless).
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage).
- **Email:** Resend (transactional + Supabase auth SMTP).
- **SMS:** Brevo (phone verification) — currently disabled (no API key set).
- **Native:** Capacitor wrapping the live site.

### 6.2 Security and privacy
- Row-level security enforced per table; users only see their own houses' data.
- Receipts in a private bucket with short-lived signed URLs.
- Rate limiting on sensitive endpoints (Postgres-backed, fails open).
- Admin area behind an email allow-list plus an admin session check.
- Supabase email confirmation currently off (signup logs in immediately).
- Pending hardening noted separately: user-side MFA, some Supabase settings.

### 6.3 Scale and known limits (honest assessment)
The current architecture comfortably stores a large number of registered users, but is not yet tuned for very high concurrency. Known ceilings to address before serious growth:
- **Realtime connections:** each active client opens ~3 to 4 Supabase Realtime channels (house data, nav unread, switcher unread, plus chat when open). This is the first hard limit on concurrent users and should be consolidated to one channel per user.
- **No response caching:** most pages render dynamically (every view hits the database). Read-heavy pages should be cached.
- **Per-request writes:** rate limiting and error logging write on each relevant request.

Capacity therefore depends heavily on the Supabase plan/compute size and on real concurrency, not on the total registered-user count. Hundreds of concurrent users need attention to the above; tens of thousands concurrent need an architecture pass (channel consolidation, caching, bigger compute, load testing).

### 6.4 Compatibility
- Modern mobile and desktop browsers; installable PWA.
- iOS build targets iPhone; export-compliance declared (no non-exempt encryption).

---

## 7. Future / not yet built

Candidate work, not implemented today:
- Realtime channel consolidation and page caching (see 6.3) for scale.
- Live unread across all houses without per-house polling/snapshots.
- Grouping identical errors in the admin log into one row with an occurrence count.
- Restoring SMS verification (re-add Brevo key or move to Twilio).
- User-facing MFA.
- Deeper insights / exportable statements.

---

## 8. Risks and open questions

- **Concurrency ceiling** from the realtime model (Section 6.3) is the main technical risk to growth.
- **Plan dependency:** real capacity is gated by the chosen Supabase tier, which is an operational decision, not a code one.
- **Trust around money:** the product records and nudges but does not move money; messaging must keep that boundary clear.
- **Original spec:** an earlier "FlatMate / HouseSync" idea document exists outside this repo (on the Desktop) and is not version-controlled here. This PRD supersedes it as the living reference.
