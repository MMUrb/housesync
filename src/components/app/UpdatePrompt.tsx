"use client";

import { useEffect, useRef, useState } from "react";
import {
  LATEST_APP_VERSIONS,
  MIN_APP_VERSIONS,
  UPDATE_NOTE,
  isOlderVersion,
} from "@/lib/appVersions";
import { afterTour, lockScroll, onHardwareBack, reportUpdatePrompt } from "@/lib/launchPrompts";

const PLAY_URL = "https://play.google.com/store/apps/details?id=uk.co.housesync";
const IOS_URL = "https://apps.apple.com/app/id6783905558";

// Re-show a dismissed soft sheet after a day: gentle, but keeps nudging until
// the update is installed. The hard gate has no snooze at all.
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const SNOOZE_KEY = "hs_update_snooze";

// Preview switch for testing on a real device without arming the real
// versions: in the app, set localStorage hs_test_update to "banner" or
// "gate" and relaunch. Remove the key to go back to normal. ("banner" is the
// historical name; it now renders the bottom sheet.)
const TEST_KEY = "hs_test_update";

type Mode = "gate" | "banner";

// Native apps only: compares the installed binary against the store policy in
// appVersions.ts. Below MINIMUM -> full-screen "Update required" gate (no
// dismiss, shown at once). Below LATEST -> dismissible "Update available"
// bottom sheet, held until the first-run tour is out of the way. The website
// never renders either. Reports its verdict on every path so the
// notifications ask (PushPrimer) can stand down when a sheet is up.
export function UpdatePrompt() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [platform, setPlatform] = useState<"ios" | "android">("android");
  const [installed, setInstalled] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let decided = false;
    let cancelled = false;
    let tour: { promise: Promise<void>; cancel: () => void } | null = null;
    const decide = (next: Mode | null) => {
      if (decided) return;
      decided = true;
      setMode(next);
      reportUpdatePrompt(next !== null);
    };

    (async () => {
      try {
        let test: string | null = null;
        try {
          test = localStorage.getItem(TEST_KEY);
        } catch {
          /* ignore */
        }

        const { Capacitor } = await import("@capacitor/core");
        const plat = Capacitor.getPlatform();
        if (plat === "ios") setPlatform("ios");

        // Work out the verdict first, with all the async plugin calls done...
        let next: Mode | null = null;
        if (test === "gate" || test === "banner") {
          setInstalled("1.1.0");
          next = test;
        } else {
          if (!Capacitor.isNativePlatform()) return decide(null);
          if (plat !== "android" && plat !== "ios") return decide(null);
          const { App } = await import("@capacitor/app");
          const info = await App.getInfo();
          if (!info.version) return decide(null);
          setInstalled(info.version);
          if (isOlderVersion(info.version, MIN_APP_VERSIONS[plat])) next = "gate";
          else if (isOlderVersion(info.version, LATEST_APP_VERSIONS[plat])) {
            let snoozedAt = 0;
            try {
              snoozedAt = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
            } catch {
              /* storage unavailable: just show it */
            }
            next = Date.now() - snoozedAt < SNOOZE_MS ? null : "banner";
          }
        }

        // ...then the gate shows immediately, while the soft sheet waits for
        // the tour so a brand-new user never sees two overlays at once.
        if (next === "banner") {
          tour = afterTour();
          await tour.promise;
          if (cancelled) return;
        }
        decide(next);
      } catch {
        // Plugin unavailable: never block the app over this.
        decide(null);
      }
    })();

    return () => {
      cancelled = true;
      tour?.cancel();
      // Unmounted before deciding: release anyone waiting on the verdict.
      decide(null);
    };
  }, []);

  // Dialog manners while an overlay is up: page behind stops scrolling and
  // focus moves into the panel. Escape and Android back close the soft sheet
  // only, never the gate.
  useEffect(() => {
    if (!mode) return;
    const unlock = lockScroll();
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const soft = mode === "banner";
    const offBack = soft ? onHardwareBack(dismissSheet) : () => {};
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && soft) dismissSheet();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function dismissSheet() {
    setMode(null);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* fine: it shows again next launch */
    }
  }

  const storeUrl = platform === "ios" ? IOS_URL : PLAY_URL;
  const storeName = platform === "ios" ? "the App Store" : "Google Play";
  const latest = LATEST_APP_VERSIONS[platform];

  if (mode === "gate") {
    return (
      <div
        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 px-6 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-gate-title"
      >
        <div ref={panelRef} tabIndex={-1} className="card w-full max-w-sm p-7 text-center outline-none">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-soft">
            <UpdateIcon className="h-8 w-8" />
          </span>
          <h2 id="update-gate-title" className="mt-5 text-xl font-bold tracking-tight text-slate-900">
            Update required
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            This version of HouseSync is no longer supported. {UPDATE_NOTE} It only takes a
            minute.
          </p>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary btn-block mt-6 py-3 text-base"
          >
            Update now
          </a>
        </div>
      </div>
    );
  }

  if (mode === "banner") {
    return (
      <div
        className="fixed inset-0 z-[90] flex items-end justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="update-sheet-title"
      >
        <button
          type="button"
          aria-label="Not now"
          onClick={dismissSheet}
          className="absolute inset-0 bg-slate-900/55"
        />
        <div
          ref={panelRef}
          tabIndex={-1}
          className="card relative w-full max-w-md rounded-b-none rounded-t-3xl px-5 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-center outline-none"
        >
          <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-mint-50 text-mint-700">
            <UpdateIcon className="h-7 w-7" />
          </span>
          <h2 id="update-sheet-title" className="mt-3 text-xl font-bold tracking-tight text-slate-900">
            A better HouseSync is out
          </h2>
          <p className="mt-1.5 px-2 text-sm leading-relaxed text-slate-500">
            {UPDATE_NOTE} Takes under a minute.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-[13px] font-bold">
            {installed && (
              <>
                <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-600">
                  You&apos;re on {installed}
                </span>
                <span className="text-slate-400" aria-hidden="true">
                  →
                </span>
              </>
            )}
            <span className="rounded-full bg-mint-50 px-3 py-1 text-mint-700">{latest}</span>
          </div>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary btn-block mt-5 py-3 text-base"
          >
            Update on {storeName}
          </a>
          <button
            type="button"
            onClick={dismissSheet}
            className="btn-ghost btn-block mt-1 text-sm text-slate-500"
          >
            Not now
          </button>
        </div>
      </div>
    );
  }

  return null;
}

function UpdateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 17V5m0 0 4.5 4.5M12 5 7.5 9.5" />
      <path d="M4 20h16" />
    </svg>
  );
}
