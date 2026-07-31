// Binary-version policy for the native apps, server-controlled via ordinary
// deploys (bump a value, git push, every app picks it up on next launch).
//
// LATEST  = newest version live in each store. Apps below it show the SOFT
//           dismissible "Update available" banner (24h snooze).
// MINIMUM = the floor. Apps below it are HARD-GATED behind a full-screen
//           "Update required" modal with no dismiss. Reserve for versions the
//           app genuinely shouldn't run on any more.
//
// The v7 (1.1.1) rollout plan:
//   1. When 1.1.1 is fully live in a store, set that platform's LATEST to
//      "1.1.1"  -> older apps get the soft banner.
//   2. A few weeks later, once most users have moved, set MINIMUM to "1.1.1"
//      -> stragglers get the hard gate.
//
// ⚠️ Never bump either value before the store rollout is fully live, or users
// are sent to a listing that has nothing new for them (and, for MINIMUM,
// locked out with no way forward). Staggered per-platform bumps are fine.
export const LATEST_APP_VERSIONS = {
  android: "1.1.0",
  ios: "1.1.0",
};

export const MIN_APP_VERSIONS = {
  android: "1.1.0",
  ios: "1.1.0",
};

/** Shown in the update prompts so the ask comes with a reason. */
export const UPDATE_NOTE = "Faster opening, smoother notifications and data downloads.";

/** True when installed `current` is older than `latest` ("1.1.0" < "1.1.1"). */
export function isOlderVersion(current: string, latest: string): boolean {
  const a = current.split(".").map((n) => parseInt(n, 10) || 0);
  const b = latest.split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x < y;
  }
  return false;
}
