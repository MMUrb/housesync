// Plain-English explanations for the admin error log. Pattern-matched and
// deliberately unclever: the goal is "what is this and should I care?", not a
// diagnosis. First matching rule wins, so order runs specific to generic.

export type ErrorExplanation = { what: string; cause: string };

type Rule = ErrorExplanation & { test: RegExp };

const RULES: Rule[] = [
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
