"use client";

import { useEffect, useRef, useState } from "react";
import { enablePush } from "@/components/push/pushClient";
import {
  PUSH_OPTOUT_KEY,
  PUSH_PROMPT_AUDIENCE,
  PUSH_PROMPT_NEW_SINCE,
  PUSH_PROMPT_SNOOZE_KEY,
  PUSH_PROMPT_SNOOZE_MS,
  PUSH_TEST_KEY,
  afterTour,
  lockScroll,
  onHardwareBack,
  updatePromptDecision,
} from "@/lib/launchPrompts";

// Native apps only: the launch-time "turn on notifications" ask. Push used to
// be opt-in via a toggle buried in Settings, which almost nobody found. This
// sheet asks once someone is signed in, and its button fires the real OS
// prompt, so saying yes is our tap plus Allow.
//
// Why a sheet of our own first: iOS shows its permission dialog exactly once
// per install. "Not now" on ours costs nothing (we can ask again later);
// "Don't Allow" on Apple's is permanent. Our sheet earns the tap before we
// spend the one shot.
//
// Never shown to anyone who already has notifications on, who turned them off
// in Settings (any OS state), or whose OS permission is already denied.
// Waits for the first-run tour and stands down if the update sheet is
// showing, so nobody gets two pop ups at once. A second "Not now" is taken
// as a real answer and stops the asking for good.
//
// Silent path: on a device's FIRST run where the OS already allows
// notifications (Android 12 and older, or a reinstall), there is no dialog
// to earn, so it just registers. Deliberately first-run only: a long-used
// device with permission granted but push off is someone who turned it off
// before the opt-out marker existed, and they get the sheet, not a silent
// re-enable.

const TOUR_KEY = "hs_tour_v1";

export function PushPrimer({ userCreatedAt }: { userCreatedAt: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    let tour: { promise: Promise<void>; cancel: () => void } | null = null;

    const read = (k: string) => {
      try {
        return localStorage.getItem(k);
      } catch {
        return null;
      }
    };

    (async () => {
      try {
        const { Capacitor } = await import("@capacitor/core");
        if (!Capacitor.isNativePlatform()) return;

        if (read(PUSH_TEST_KEY) === "1") {
          setOpen(true);
          return;
        }

        // Turned off in Settings: never ask again, whatever the OS says.
        if (read(PUSH_OPTOUT_KEY) === "1") return;

        // Captured now, before the tour (which we may wait for) marks itself done.
        const firstRun = read(TOUR_KEY) !== "done";

        const { PushNotifications } = await import("@capacitor/push-notifications");
        const perm = (await PushNotifications.checkPermissions()).receive;

        if (perm === "denied") return; // iOS: permanent, asking again is a no-op
        if (perm === "granted") {
          if (read("hs_push") === "1") return; // already on
          if (firstRun) {
            await enablePush(); // no dialog to show, just register
            return;
          }
          // Otherwise fall through to the sheet: the button will register
          // without a dialog, but the choice stays with the user.
        }

        // From here on it is about whether to SHOW the sheet.
        if (PUSH_PROMPT_AUDIENCE === "new" && userCreatedAt < PUSH_PROMPT_NEW_SINCE) return;

        const snoozedAt = Number(read(PUSH_PROMPT_SNOOZE_KEY) ?? 0);
        if (Date.now() - snoozedAt < PUSH_PROMPT_SNOOZE_MS) return;

        tour = afterTour();
        await tour.promise;
        if (cancelled) return;

        // One sheet per launch: the update prompt has priority. If it never
        // reports (plugin hiccup), don't wait forever.
        const updateShowing = await Promise.race([
          updatePromptDecision,
          new Promise<boolean>((r) => setTimeout(() => r(false), 4000)),
        ]);
        if (cancelled || updateShowing) return;

        setOpen(true);
      } catch {
        /* plugin unavailable: never block the app over this */
      }
    })();

    return () => {
      cancelled = true;
      tour?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dialog manners while open: page behind stops scrolling, focus moves into
  // the sheet and comes back afterwards, Escape and Android back mean not now.
  useEffect(() => {
    if (!open) return;
    const unlock = lockScroll();
    const offBack = onHardwareBack(notNow);
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && notNow();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function snooze() {
    try {
      localStorage.setItem(PUSH_PROMPT_SNOOZE_KEY, String(Date.now()));
    } catch {
      /* fine */
    }
  }

  function notNow() {
    // First "not now" snoozes a fortnight; a second one is an answer.
    try {
      if (localStorage.getItem(PUSH_PROMPT_SNOOZE_KEY) !== null) {
        localStorage.setItem(PUSH_OPTOUT_KEY, "1");
      }
    } catch {
      /* fine */
    }
    snooze();
    setOpen(false);
  }

  async function turnOn() {
    if (busy) return;
    setBusy(true);
    const res = await enablePush();
    // Denied at the OS dialog: iOS will now report "denied" for good and
    // Android for a while, so back off. Any other failure (network, plugin)
    // is left un-snoozed so the next launch can simply try again.
    if (!res.ok && res.denied) snooze();
    setBusy(false);
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="push-primer-title"
    >
      <button type="button" aria-label="Not now" onClick={notNow} className="absolute inset-0 bg-slate-900/55" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="card relative w-full max-w-md rounded-b-none rounded-t-3xl px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center outline-none"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
          <svg
            viewBox="0 0 24 24"
            className="h-7 w-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
            <path d="M13.7 20a2 2 0 0 1-3.4 0" />
          </svg>
        </span>
        <h2 id="push-primer-title" className="mt-3 text-xl font-bold tracking-tight text-slate-900">
          Know the moment it happens
        </h2>
        <p className="mt-1.5 px-2 text-sm leading-relaxed text-slate-500">
          HouseSync works best when it can give you a nudge. Tap below, then Allow, and you&apos;re
          set.
        </p>

        <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 text-left">
          <Row tone="mint" label="Someone pays you back">
            <path d="M12 3v12M7 10l5 5 5-5" />
            <path d="M4 21h16" />
          </Row>
          <Row tone="amber" label="A bill needs your share">
            <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" />
            <path d="M9 8h6M9 12h6" />
          </Row>
          <Row tone="brand" label="New messages in house chat">
            <path d="M21 12a8 8 0 1 1-3.5-6.6" />
            <path d="M3 20.5 4.6 16" />
          </Row>
        </ul>

        <button
          type="button"
          onClick={turnOn}
          disabled={busy}
          className="btn-primary btn-block mt-5 py-3 text-base"
        >
          {busy ? "One moment…" : "Turn on notifications"}
        </button>
        <button
          type="button"
          onClick={notNow}
          disabled={busy}
          className="btn-ghost btn-block mt-1 text-sm text-slate-500"
        >
          Not now
        </button>
      </div>
    </div>
  );
}

function Row({
  tone,
  label,
  children,
}: {
  tone: "mint" | "amber" | "brand";
  label: string;
  children: React.ReactNode;
}) {
  const tones = {
    mint: "bg-mint-50 text-mint-700",
    amber: "bg-amber-50 text-amber-700",
    brand: "bg-brand-50 text-brand-600",
  } as const;
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {children}
        </svg>
      </span>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </li>
  );
}
