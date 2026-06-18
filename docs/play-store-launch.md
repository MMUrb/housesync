# HouseSync — Google Play launch pack

Everything needed to publish on Google Play, paste-ready. Plan: ship to an
**Internal testing** track first (waitlist gate stays up, reviewer gets the
code), then promote to **Production** and flip `WAITLIST_ENABLED=false`.

Build to upload: **`Desktop\HouseSync-release.aab`** (signed, versionCode 1).
Bump `versionCode` in `android/app/build.gradle` for every future upload.

---

## 0) Direct links (do these in order)
1. Create developer account ($25 one-time): https://play.google.com/console/signup
2. Play Console (home): https://play.google.com/console
3. Launch checklist (Google's): https://support.google.com/googleplay/android-developer/answer/9859152
4. Graphic asset specs: https://support.google.com/googleplay/android-developer/answer/9866151
5. Data safety help: https://support.google.com/googleplay/android-developer/answer/10787469
6. Content rating help: https://support.google.com/googleplay/android-developer/answer/9859655
7. Vercel env (to flip the gate later): https://vercel.com/mmurbs-projects/housesync/settings/environment-variables

In the console: **All apps → Create app** → name "HouseSync", default language
**English (United Kingdom)**, type **App**, **Free**. Then work down the
"Set up your app" + "Store presence" tasks below.

---

## 1) Store listing (Store presence → Main store listing)

**App name (≤30):** `HouseSync: Split House Bills`  *(alts: `HouseSync – Bills & Chores`, `HouseSync: Housemate Bills`)*

**Short description (≤80):**
`Split rent, bills & groceries, track chores & settle up with your housemates.`

**Full description (≤4000):**
```
Stop arguing about house bills.

HouseSync is the easy way for housemates and flatmates to split rent, bills and the food shop, stay on top of chores, and settle up — without the awkward money chats.

Made for UK shared houses: students, apprentices and young professionals living together.

💸 Split anything, fairly
• Rent, bills, groceries, the takeaway — split equally, by custom amounts, or by %
• Snap a receipt and attach it
• See exactly who owes who at a glance

🔁 Never miss a bill
• Add recurring bills (rent, wi-fi, energy, council tax) and log payments
• Friendly reminders so no one forgets

🧹 End the chore wars
• A shared chore rota that rotates automatically
• Everyone knows whose turn it is

✅ Settle up, drama-free
• Clear balances, mark payments, send a polite nudge
• It's about keeping the house clear, not keeping score

💬 Your house, in one place
• A house group chat so plans don't get lost in the WhatsApp scroll
• Invite your whole house in seconds (link, WhatsApp or QR code)

🆓 Free for your whole house. No card needed.

Whether you're moving into your first student house or you've shared for years, HouseSync keeps everyone on the same page — and the money fair.

Questions or ideas? hello@housesync.co.uk
```

**Graphics (all generated — in the `assets/` folder):**
- **App icon (512×512):** `assets/play-icon-512.png` ✅
- **Feature graphic (1024×500):** `assets/play-feature-graphic-1024x500.png` ✅
- **Phone screenshots (2–8, you provide):** 9:16, PNG/JPEG, each side 320–3840px (1080×2400 is ideal). Easiest: take them on your phone from the installed app. Suggested set + captions:
  1. Dashboard / balances — "Who owes who, at a glance"
  2. Add expense (split screen) — "Split the food shop in seconds"
  3. Bills hub — "Never miss a bill"
  4. Chores — "Whose turn to clean? Sorted."
  5. House chat — "Your house chat, in one place"
  *(Send me 4–5 raw phone screenshots and I'll frame + caption them into polished marketing tiles.)*

---

## 2) App content → Data safety
Encryption in transit: **Yes.** Users can request deletion: **Yes** (in-app, Settings → delete account). Data is **not sold**, and **not shared** with third parties (Supabase, Brevo and Firebase are processors acting on HouseSync's behalf — that's "collected", not "shared"). No data used for advertising.

Declare these as **collected**:

| Data type (Play category) | Purpose(s) | Required? |
|---|---|---|
| Name (Personal info) | App functionality, Account management | Required |
| Email address (Personal info) | App functionality, Account management | Required |
| User payment info — payment handles + bank sort code/acct for settle-up (Financial info) | App functionality | Optional |
| In-app messages — house chat (Messages) | App functionality | Optional |
| Photos — receipts & avatars (Photos and videos) | App functionality | Optional |
| App interactions — expenses/bills/chores (App activity) | App functionality, Analytics | Required |
| Crash logs (App info & performance) | Analytics | Required |
| Diagnostics — page analytics (App info & performance) | Analytics | Required |
| Approximate location — country/city from IP, analytics only (Location) | Analytics | Required |
| Device IDs — push token (Device or other IDs) | App functionality (notifications) | Optional |

---

## 3) App content → Content rating (IARC questionnaire)
- Category: **Utility / Reference / Other** (or Social — it has chat).
- Violence / sexual content / profanity / controlled substances / gambling / horror: **No** to all.
- **Do users interact or communicate?** **Yes** (house chat).
- **Can users share personal info with other users?** **Yes** (housemates see names; payment details by consent).
- Shares user's location with other users: **No.**
- Digital purchases: **No.**
- Expected result: **Everyone / PEGI 3**, with "Users Interact" + "Shares Info" labels.

---

## 4) App content → App access
The app needs sign-in **and** the early-access gate is on. Choose "All or some
functionality is restricted" and add these instructions:

```
HouseSync requires an account, and the site currently has an early-access gate.

1. Launch the app. On the early-access screen, tap "Have an access code?" and
   enter the code: <YOUR_WAITLIST_ACCESS_CODE>
2. Sign in with this test account:
   Email: <REVIEW_TEST_EMAIL>
   Password: <REVIEW_TEST_PASSWORD>
3. You'll land on the dashboard. Create or join a house to see all features
   (expenses, bills, chores, chat).
```
**You provide:** the waitlist access code, and a dedicated test account (create
one at housesync.co.uk and don't change its password before review).

---

## 5) Other "Set up your app" tasks
- **Privacy policy URL:** `https://housesync.co.uk/privacy`
- **Ads:** No ads.
- **Target audience & content:** target age **18+** (finance app); not directed at children.
- **App category:** **Finance** (alt: Lifestyle). Contact email: `hello@housesync.co.uk`. Website: `https://housesync.co.uk`.
- **Countries:** start with **United Kingdom** (+ Ireland), expand later.

---

## 6) Upload the build (Testing → Internal testing)
1. **Testing → Internal testing → Create new release.**
2. Let Google **opt you into Play App Signing** (recommended — your upload key
   becomes resettable).
3. Upload **`Desktop\HouseSync-release.aab`**.
4. Release name e.g. `1.0 (1)`. Release notes:
   ```
   First release of HouseSync — split bills, track chores, and settle up with your housemates.
   ```
5. Add yourself (+ testers) to the internal-test list, save, **review & roll out**.
6. Install via the internal-test opt-in link on your phone and sanity-check the
   signed build.

When the build checks out, **do NOT jump to Production** — a new personal
account must clear closed testing first (below).

---

## 7) Closed testing — REQUIRED before Production (12 testers / 14 days)
A personal Play account must run a **closed test with at least 12 testers opted
in for at least 14 continuous days** before it can publish to Production. Start
this ASAP so the 14-day clock runs in the background.

1. **Testing → Closed testing → Create track** (or use the default "Alpha").
2. **Create new release** → upload the same **`Desktop\HouseSync-release.aab`**
   (or promote the internal-testing release into this track) → release notes →
   **Save → Review → Roll out**.
3. **Testers** — use a **Google Group** (easiest to manage + grow):
   - Create a group at https://groups.google.com (e.g. `housesync-testers`),
     set "Who can join the group" so testers can join themselves.
   - In the track's **Testers** tab, add that **group email address**.
   - Testers join the group, then open the **opt-in link** (Play reveals it once
     the release is live) on their Android phone and install from Play.
     *(Email-list alternative: upload `Desktop\play-testers.csv`, one Gmail per line.)*
4. **Get 12 real testers opted in** — housemates/friends + 1–2 of your own
   devices + tester-exchange communities (r/AndroidAppTesting). Each must **stay
   opted in** for the full 14 days; don't pad it with alt emails (Google checks).
5. Watch **Testing → Closed testing → [your track]** — it shows the opted-in
   count. After **12 testers for 14 continuous days**, **"Apply for production
   access"** unlocks.

## 8) Production (after closed testing clears)
1. Apply for and receive production access (post the 12/14 closed test).
2. Promote the release to **Production**; finish any remaining listing tasks.
3. **Set `WAITLIST_ENABLED=false` in Vercel + redeploy** so the public can use it.

---

## 9) Tester recruitment message (paste into exchange groups)
Fill in `[OPT-IN LINK]` once the closed track is rolled out.

**Chat groups (Telegram / Discord / WhatsApp testing groups):**
```
Hi all! 👋 Looking for ~12 testers for my Android app, HouseSync. It helps housemates split rent, bills and the food shop, track chores, and settle up without the awkward money chats.

It's a Google Play closed test, so all I need from you is:
1) Join here: [OPT-IN LINK]
2) Install HouseSync from the Play Store
3) Keep it installed for 14 days (open it now and then; feedback welcome but not required)

Happy to test yours back, just drop your link and I'll join 🙌 (Android only, cheers!)
```

**Reddit (r/AndroidAppTesting / r/GooglePlayDeveloper):**
Title: `[Android] HouseSync: split bills & chores with housemates (I'll test back ↔️)`
```
Hey! Looking for 12 testers to clear Google's closed-testing requirement for my app, HouseSync. It helps housemates split rent, bills and groceries, track chores, and settle up.

What I need:
- Join the test: [OPT-IN LINK]
- Install from the Play Store and keep it for 14 days
- Open it occasionally; feedback welcome but not required

I'll happily test your app back, comment your link and I'll opt in. Android only. Thanks a ton! 🙏
```
