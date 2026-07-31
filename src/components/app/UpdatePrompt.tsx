"use client";

import { useEffect, useState } from "react";
import {
  LATEST_APP_VERSIONS,
  MIN_APP_VERSIONS,
  UPDATE_NOTE,
  isOlderVersion,
} from "@/lib/appVersions";

const PLAY_URL = "https://play.google.com/store/apps/details?id=uk.co.housesync";
const IOS_URL = "https://apps.apple.com/app/id6783905558";

// Re-show a dismissed soft banner after a day — gentle, but keeps nudging
// until the update is installed. The hard gate has no snooze at all.
const SNOOZE_MS = 24 * 60 * 60 * 1000;
const SNOOZE_KEY = "hs_update_snooze";

// Preview switch for testing on a real device without arming the real
// versions: in the app, set localStorage hs_test_update to "banner" or
// "gate" and relaunch. Remove the key to go back to normal.
const TEST_KEY = "hs_test_update";

type Mode = "gate" | "banner";

// Native apps only: compares the installed binary against the store policy in
// appVersions.ts. Below MINIMUM -> full-screen "Update required" gate (no
// dismiss). Below LATEST -> dismissible "Update available" banner. The
// website never renders either.
export function UpdatePrompt() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [storeUrl, setStoreUrl] = useState<string>(PLAY_URL);

  useEffect(() => {
    (async () => {
      try {
        let test: string | null = null;
        try {
          test = localStorage.getItem(TEST_KEY);
        } catch {
          /* ignore */
        }

        const { Capacitor } = await import("@capacitor/core");
        const platform = Capacitor.getPlatform();
        if (platform === "ios") setStoreUrl(IOS_URL);

        if (test === "gate" || test === "banner") {
          setMode(test);
          return;
        }

        if (!Capacitor.isNativePlatform()) return;
        if (platform !== "android" && platform !== "ios") return;

        const { App } = await import("@capacitor/app");
        const info = await App.getInfo();
        if (!info.version) return;

        if (isOlderVersion(info.version, MIN_APP_VERSIONS[platform])) {
          setMode("gate");
          return;
        }
        if (isOlderVersion(info.version, LATEST_APP_VERSIONS[platform])) {
          try {
            const snoozedAt = Number(localStorage.getItem(SNOOZE_KEY) ?? 0);
            if (Date.now() - snoozedAt < SNOOZE_MS) return;
          } catch {
            /* storage unavailable — just show it */
          }
          setMode("banner");
        }
      } catch {
        /* plugin unavailable — never block the app over this */
      }
    })();
  }, []);

  // Freeze the page behind the hard gate while it's up.
  useEffect(() => {
    if (mode !== "gate") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mode]);

  function dismissBanner() {
    setMode(null);
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()));
    } catch {
      /* fine — it'll show again next launch */
    }
  }

  if (mode === "gate") {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/70 px-6 backdrop-blur-sm">
        <div className="card w-full max-w-sm p-7 text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-white shadow-soft">
            <UpdateIcon className="h-8 w-8" />
          </span>
          <h2 className="mt-5 text-xl font-bold tracking-tight text-slate-900">Update required</h2>
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
      <div className="card mb-4 flex items-center gap-3 border-brand-100 bg-gradient-to-br from-brand-50 to-white p-3.5 dark:border-white/10 dark:from-brand-500/15 dark:to-transparent">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/25">
          <UpdateIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Update available</p>
          <p className="text-xs text-slate-500">{UPDATE_NOTE}</p>
        </div>
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary shrink-0 px-3.5 py-2 text-sm"
        >
          Update
        </a>
        <button
          type="button"
          onClick={dismissBanner}
          aria-label="Dismiss update reminder"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 dark:hover:bg-white/[0.06]"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
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
      <path d="M12 16V4m0 12 4.5-4.5M12 16l-4.5-4.5" />
      <path d="M4 20h16" />
    </svg>
  );
}
