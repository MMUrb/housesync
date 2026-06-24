# HouseSync, iOS / App Store asset kit

Everything for the App Store listing in one place. The app icon and splash are
already built into the Xcode project (`ios/App/App/Assets.xcassets`); this folder
holds the standalone copies plus the listing copy and screenshot specs.

## In this folder
- `AppStore-icon-1024.png`, the 1024x1024 app icon, opaque (no alpha, no rounded
  corners, Apple rounds it). Already embedded in the build, kept here as a backup.
- `screenshots/`, drop your raw phone screenshots here and I will frame them.

## App icon, done
Generated from your brand icon: full opaque square, purple gradient, white house
with sync mark. Embedded in the Xcode project as `AppIcon-512@2x.png`, so the
build carries it automatically (App Store Connect reads the icon from the build).

## Screenshots, you provide (the one missing piece)
Apple requires at least one iPhone set. Take them from the app (or housesync.co.uk
in Safari, since the app loads the same site).
- **iPhone 6.9"** (e.g. 16 Pro Max): **1320 x 2868** px, portrait. This is the
  primary required size; Apple scales it down for smaller iPhones.
- **iPhone 6.7"** (1290 x 2796) is also accepted.
- **iPad 13"** (2064 x 2752) only if you enable iPad support.
- 1 to 10 per size, PNG or JPEG, **no transparency**.
- Apple does not overlay captions; any text is baked into the image. Suggested
  shots and captions:
  1. Dashboard / balances, "Who owes who, at a glance"
  2. Add expense, "Split the food shop in seconds"
  3. Bills, "Never miss a bill"
  4. Chores, "Whose turn to clean? Sorted."
  5. House chat, "Your house chat, in one place"

Send me 4 or 5 raw shots and I will produce framed, captioned tiles at the right size.

## App Store Connect listing copy (paste-ready)
- **Name:** `HouseSync`
- **Subtitle (max 30):** `Split bills with housemates`
- **Promotional text (max 170):** `The easy way to split rent, bills and chores with your housemates, and settle up without the awkward money chats.`
- **Keywords (max 100):** `housemate,flatmate,roommate,rent,bills,split,chores,expense,share,utilities,house,students,money`
- **Support URL:** `https://housesync.co.uk`
- **Marketing URL:** `https://housesync.co.uk`
- **Privacy Policy URL:** `https://housesync.co.uk/privacy`
- **Primary category:** Finance (secondary: Lifestyle)
- **Age rating:** complete Apple's questionnaire; answer No to mature content.
  The house chat is private between housemates, so this comes out low (4+ or 12+).

**Description:**
```
Stop arguing about house bills.

HouseSync is the easy way for housemates and flatmates to split rent, bills and the food shop, stay on top of chores, and settle up, without the awkward money chats.

Made for UK shared houses: students, apprentices and young professionals living together.

Split anything, fairly
- Rent, bills, groceries, the takeaway. Split equally, by custom amounts, or by percentage.
- Snap a receipt and attach it.
- See exactly who owes who at a glance.

Never miss a bill
- Add recurring bills (rent, wi-fi, energy, council tax) and log payments.
- Friendly reminders so no one forgets.

End the chore wars
- A shared chore rota that rotates automatically.
- Everyone knows whose turn it is.

Settle up, drama-free
- Clear balances, mark payments, send a polite nudge.

Your house, in one place
- A house group chat so plans do not get lost in the WhatsApp scroll.
- Invite your whole house in seconds.

Free for your whole house. No card needed.

Questions or ideas? hello@housesync.co.uk
```

## Build and submit
The iOS app builds on a cloud Mac via `codemagic.yaml` in the repo root (no local
Mac needed). Full step by step, App access reviewer notes, and data-privacy
answers are in `docs/play-store-launch.md` (the Data safety answers map directly
onto Apple's App Privacy questions too).
