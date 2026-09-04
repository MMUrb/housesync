// Launch-time prompts on the native apps: the "update available" sheet and
// the "turn on notifications" ask. Both are controlled from here and ship via
// ordinary web deploys, so changing who sees what never needs a store build.

/**
 * Who gets the notifications ask.
 * - "everyone": every native user who does not have push on yet. Use while
 *   sweeping the existing user base (most installs never found the toggle).
 * - "new": only accounts created on or after PUSH_PROMPT_NEW_SINCE, i.e.
 *   fresh downloads. Flip to this a few weeks after launch.
 * Either way, people who already have notifications on never see it.
 */
export const PUSH_PROMPT_AUDIENCE: "everyone" | "new" = "everyone";

/** ISO date. With audience "new", accounts created before this are skipped. */
export const PUSH_PROMPT_NEW_SINCE = "2026-08-18";

/** "Not now" on the notifications ask brings it back after this long. */
export const PUSH_PROMPT_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
export const PUSH_PROMPT_SNOOZE_KEY = "hs_push_primer_snooze";

/**
 * Set when the user turns notifications OFF in Settings. The OS permission
 * survives an in-app opt-out, so without this marker the primer's
 * "permission already granted, just register" shortcut would quietly undo a
 * deliberate choice.
 */
export const PUSH_OPTOUT_KEY = "hs_push_optout";

/** Device test switch: set localStorage hs_test_push to "1" to force the ask. */
export const PUSH_TEST_KEY = "hs_test_push";

// ---------------------------------------------------------------------------
// One sheet per launch. The update prompt decides first (it is rarer and more
// important); the notifications ask waits for that verdict and stands down if
// an update sheet is showing. Module-level so the two components need not know
// about each other's render tree.
// ---------------------------------------------------------------------------
let resolveUpdateDecision: (showing: boolean) => void = () => {};
export const updatePromptDecision: Promise<boolean> = new Promise((resolve) => {
  resolveUpdateDecision = resolve;
});
/** Called by UpdatePrompt once it knows whether it is showing anything. */
export function reportUpdatePrompt(showing: boolean): void {
  resolveUpdateDecision(showing);
}

// ---------------------------------------------------------------------------
// Shared sheet plumbing
// ---------------------------------------------------------------------------

/**
 * Resolves once the first-run tour is out of the way: immediately if it has
 * already been done (or storage is blocked, in which case the tour never
 * opens), otherwise on the hs:tour-done event Walkthrough dispatches.
 */
export function afterTour(): { promise: Promise<void>; cancel: () => void } {
  let done = false;
  try {
    done = localStorage.getItem("hs_tour_v1") === "done";
  } catch {
    done = true; // no storage, no tour
  }
  if (done) return { promise: Promise.resolve(), cancel: () => {} };
  let handler: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    handler = () => resolve();
    window.addEventListener("hs:tour-done", handler, { once: true });
  });
  return { promise, cancel: () => window.removeEventListener("hs:tour-done", handler) };
}

/**
 * Body scroll lock that survives two overlays overlapping: the page only
 * unlocks when the last one closes, whatever order they close in.
 */
let scrollLocks = 0;
let scrollPrev = "";
export function lockScroll(): () => void {
  if (scrollLocks === 0) {
    scrollPrev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks--;
    if (scrollLocks === 0) document.body.style.overflow = scrollPrev;
  };
}

/**
 * Android hardware back while a sheet is open should close the sheet, not
 * navigate behind it. BackButton dispatches a cancelable "hs:back" first;
 * an open sheet claims it here.
 */
export function onHardwareBack(handler: () => void): () => void {
  const h = (e: Event) => {
    e.preventDefault();
    handler();
  };
  window.addEventListener("hs:back", h);
  return () => window.removeEventListener("hs:back", h);
}
