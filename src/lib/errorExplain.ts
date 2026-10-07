// Plain-English explanations for the admin error log. Pattern-matched and
// deliberately unclever: the goal is "what is this and should I care?", not a
// diagnosis. First matching rule wins, so order runs specific to generic.

export type ErrorExplanation = { what: string; cause: string };

type Rule = ErrorExplanation & { test: RegExp };

const RULES: Rule[] = [
  {
    test: /required.agreements|updated agreement/i,
    what: "Apple is refusing the App Store data sync until an updated agreement is accepted.",
    cause:
      "Apple changed one of its developer agreements. Sign in as the Account Holder at developer.apple.com/account and accept it (App Store Connect > Business shows agreement status too). Nothing in the code is broken; the next sync catches the missed days up. Until it's accepted, Apple also blocks new build uploads.",
  },
  {
    test: /^store sync:/i,
    what: "The nightly download and review sync couldn't get data from one of the stores.",
    cause:
      "That store's numbers and reviews on Acquisition stop updating until it works again. The message names the store and its reason; once fixed, Sync now on Acquisition catches up every missed day.",
  },
  {
    test: /^script error\.?$/i,
    what: "Code that isn't HouseSync's failed, and the browser hid the details on purpose.",
    cause:
      "Browsers only say \"Script error.\" for code from another origin. HouseSync loads no outside scripts, so this comes from something the browser injected: usually an in-app browser (Snapchat, Instagram, TikTok) or an extension. Nothing to fix; new ones are no longer logged.",
  },
  {
    test: /^background (save|action) failed:/i,
    what: "Something the app does on its own was refused. Nobody saw anything.",
    cause:
      "These are behind-the-scenes jobs: recording when someone was last active, chat read receipts, settle-up finishing off a settled house, and saving a phone's notification token at launch. Dropped connections on them are ignored because they retry by themselves, so an entry here means the server really said no, which points at a bug worth a look.",
  },
  {
    test: /^action failed:/i,
    what: "Something someone tried to do didn't go through. They saw an error.",
    cause:
      "It names the action (deleting their account, turning on notifications, sending a reminder or the verify-email link) and the reason. \"connection dropped\" means their signal went: nothing to fix. A number like 500 means our own server failed, which is worth a look. Deliberate no's like \"too soon\" aren't reported.",
  },
  {
    test: /^save failed:/i,
    what: "Something someone did in the app didn't save.",
    cause:
      "The message says what (e.g. \"expenses (insert)\" is a new expense) and why. If it was the thing they were doing, they saw an error and can try again. \"connection dropped\" means their signal went mid-save: nothing to fix. A number like 403 or a code like 42501 means the database refused the change; anything else is worth a look as a possible bug.",
  },
  {
    test: /minified react error #4(18|23|25)|hydrat/i,
    what: "The page the server sent didn't match what the device drew first, so React threw it away and redrew.",
    cause:
      "Date, time or locale text rendered differently on the server than on the phone (Apple's engines even spell month names differently, e.g. Sep vs Sept), or the device is still running an old cached build. Check the App build line below: if it's older than live, the bug is already fixed and this is a replay.",
  },
  {
    test: /chunkloaderror|loading chunk .+ failed|dynamically imported module/i,
    what: "The browser asked for a piece of the app's code that no longer exists on the server.",
    cause:
      "A tab that stayed open across a deploy. The app reloads itself once to recover, so this only lands here when that wasn't enough.",
  },
  {
    test: /load failed|failed to fetch|network ?error|connection was lost|request timed out/i,
    what: "A network request died before it finished.",
    cause:
      "Usually the user's connection dropping, or iOS pausing the app mid-request. Only interesting if it spikes or clusters on one path.",
  },
  {
    test: /pgrst\d+|row.level security|violates .+ constraint|duplicate key|column .+ does not exist/i,
    what: "The database refused a query from the app.",
    cause:
      "The query disagrees with the schema or its security rules, e.g. code expecting one row where several exist. Genuine bug territory, worth a look.",
  },
  {
    test: /apns|fcm|push subscription|device token/i,
    what: "A push notification couldn't be delivered to a device.",
    cause:
      "Most often a stale device token from an app that was uninstalled or reset. Expected in small numbers.",
  },
  {
    test: /jwt|refresh token|not authenticated|session expired|invalid token/i,
    what: "A signed-in session stopped being valid mid-use.",
    cause:
      "An expired or revoked login token, often a long-idle tab waking up. The user signs in again and carries on.",
  },
  {
    test: /cannot read propert|undefined is not|null is not an object|is not a function/i,
    what: "The code tried to use a value that wasn't there. A genuine bug.",
    cause: "A missing null-check on this path; the stack trace points at the exact spot.",
  },
  {
    test: /abort/i,
    what: "A request was cancelled before it finished.",
    cause: "Normally deliberate: the user navigated away mid-load. Noise unless it's constant.",
  },
];

export function explainError(message: string, source: string): ErrorExplanation {
  for (const r of RULES) if (r.test.test(message)) return { what: r.what, cause: r.cause };
  return source === "server"
    ? {
        what: "An unexpected error in the server code while handling this path.",
        cause:
          "Not a known pattern. The message and stack below are the lead; the path says which route was running.",
      }
    : {
        what: "An unexpected error in the browser on this page.",
        cause: "Not a known pattern. The stack trace below points at the code involved.",
      };
}
