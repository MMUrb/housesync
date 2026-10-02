"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { enablePush, getPlatform, webPushSupported } from "@/components/push/pushClient";
import { showToast } from "@/components/app/Toast";
import { createClient } from "@/lib/supabase/client";
import {
  PUSH_OPTOUT_KEY,
  afterRentPopup,
  afterTour,
  getUpdatePromptDecision,
  lockScroll,
  onHardwareBack,
} from "@/lib/launchPrompts";
import {
  ALERTS_PROMPT_MIN_AGE_MS,
  ALERTS_TEST_KEY,
  ALL_PUSH_COLUMNS,
  PAYMENT_PUSH_TYPES,
  alertsPromptDue,
  alertsPromptKey,
  nextAlertsRecord,
  parseAlertsRecord,
  pickAlertsMode,
  type AlertsDevice,
  type PaymentAlertsMode,
  type RecentPayment,
} from "@/lib/paymentAlerts";

// The "Don't miss a payment" pop-up, for people whose notifications are off
// (or whose payment ones are). Three versions, picked per device by
// pickAlertsMode: off (one tap turns them on, quoting a real recent payment as
// the reason when there is one), partial (one tap turns every type back on),
// blocked in the phone's own settings (the steps to fix it; on iPhone a
// button that opens HouseSync's settings page).
//
// Shown on the dashboard, not in anyone's first week (the launch-time ask has
// them), at most once a fortnight and three times per device, recorded the
// moment it shows. Waits for the tour, the update sheet and the rent pop-up,
// then stands down if any other sheet is open, so it never stacks.

type Platform = "ios" | "android" | "web";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

async function readDevice(platform: Platform, pushElsewhere: boolean): Promise<AlertsDevice> {
  if (platform !== "web") {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const p = (await PushNotifications.checkPermissions()).receive;
    return {
      kind: "native",
      perm: p === "granted" ? "granted" : p === "denied" ? "denied" : "prompt",
      registered: read("hs_push") === "1",
      optedOut: read(PUSH_OPTOUT_KEY) === "1",
    };
  }
  const supported = webPushSupported();
  const perm = supported ? Notification.permission : "default";
  let subscribed = false;
  if (supported && perm === "granted") {
    const reg = await navigator.serviceWorker.getRegistration();
    subscribed = Boolean(await reg?.pushManager.getSubscription());
  }
  return { kind: "web", supported, perm, subscribed, pushElsewhere };
}

export function PaymentAlertsPrompt({
  userId,
  userCreatedAt,
  offTypes,
  recent,
  pushElsewhere,
}: {
  userId: string;
  userCreatedAt: string;
  /** Payment switches turned off in Settings, by name ("Payments to you"). */
  offTypes: string[];
  recent: RecentPayment | null;
  /** Push already reaches them on another device (only matters on the website). */
  pushElsewhere: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<PaymentAlertsMode | null>(null);
  const [platform, setPlatform] = useState<Platform>("web");
  const [busy, setBusy] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const stopWatching = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    let tour: { promise: Promise<void>; cancel: () => void } | null = null;
    let rentPopup: { promise: Promise<void>; cancel: () => void } | null = null;

    (async () => {
      try {
        const test = read(ALERTS_TEST_KEY);
        const forced = test === "off" || test === "partial" || test === "blocked" ? test : null;
        const key = alertsPromptKey(userId);

        let record = parseAlertsRecord(null);
        if (!forced) {
          const created = Date.parse(userCreatedAt);
          if (!Number.isFinite(created) || Date.now() - created < ALERTS_PROMPT_MIN_AGE_MS) return;
          try {
            record = parseAlertsRecord(localStorage.getItem(key));
          } catch {
            return; // no storage, no pop-up: it would show on every visit
          }
          if (!alertsPromptDue(record, Date.now())) return;
        }

        const plat = await getPlatform();
        const next = forced ?? pickAlertsMode(await readDevice(plat, pushElsewhere), offTypes.length > 0);
        if (!next || cancelled) return;

        tour = afterTour();
        await tour.promise;
        if (cancelled) return;
        // One sheet per launch: the update sheet outranks this, and if its
        // verdict never comes (plugin hiccup), don't wait forever.
        const updateShowing = await Promise.race([
          getUpdatePromptDecision(),
          new Promise<boolean>((r) => setTimeout(() => r(false), 4000)),
        ]);
        if (cancelled || updateShowing) return;
        rentPopup = afterRentPopup();
        await rentPopup.promise;
        if (cancelled) return;
        // Let the page settle, then give way to anything else already up
        // (the first notifications ask, a "Sam just joined" sheet).
        await new Promise((r) => setTimeout(r, 1500));
        if (cancelled || document.querySelector('[aria-modal="true"]')) return;

        if (!forced) {
          try {
            localStorage.setItem(key, JSON.stringify(nextAlertsRecord(record, Date.now())));
          } catch {
            return;
          }
        }
        setPlatform(plat);
        setMode(next);
      } catch {
        /* plugin unavailable: never block the dashboard over this */
      }
    })();

    return () => {
      cancelled = true;
      tour?.cancel();
      rentPopup?.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => stopWatching.current?.(), []);

  // Dialog manners while open: the page behind stops scrolling, focus moves
  // in and comes back, Escape and Android back mean "not now".
  useEffect(() => {
    if (!mode) return;
    const unlock = lockScroll();
    const offBack = onHardwareBack(close);
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
      prevFocus?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function close() {
    if (!busy) setMode(null);
  }

  async function switchOn(cols: readonly string[]): Promise<boolean> {
    const row: Record<string, unknown> = { user_id: userId };
    for (const c of cols) row[c] = true;
    const { error } = await createClient()
      .from("account_settings")
      .upsert(row, { onConflict: "user_id" });
    if (error) return false;
    router.refresh(); // Settings shows the new switches straight away
    return true;
  }

  // Turning push on is only half the promise if the payment switches are
  // still off, so those come on with it.
  async function turnOn(): Promise<void> {
    const res = await enablePush();
    if (res.ok) {
      if (offTypes.length > 0) await switchOn(PAYMENT_PUSH_TYPES.map((t) => t.col));
      showToast({ message: "Notifications are on" });
    } else if (!res.denied) {
      showToast({ message: res.reason ?? "Couldn't turn on notifications. Try again from Settings." });
    }
  }

  // Blocked: once they come back from the phone's settings with notifications
  // allowed, finish the job (register this device) without another tap.
  async function watchForReturn() {
    if (stopWatching.current) return;
    try {
      const { App } = await import("@capacitor/app");
      let checking = false;
      const handle = await App.addListener("resume", async () => {
        if (checking) return;
        checking = true;
        try {
          const { PushNotifications } = await import("@capacitor/push-notifications");
          if ((await PushNotifications.checkPermissions()).receive === "granted") {
            stopWatching.current?.();
            await turnOn();
          }
        } catch {
          /* try again on the next return */
        } finally {
          checking = false;
        }
      });
      stopWatching.current = () => {
        void handle.remove();
        stopWatching.current = null;
      };
    } catch {
      /* no app plugin: the next launch's checks pick it up */
    }
  }

  async function primary() {
    if (busy || !mode) return;
    if (mode === "blocked") {
      await watchForReturn(); // listening before the app goes to the background
      setMode(null);
      // iOS opens custom schemes through the system (Capacitor's navigation
      // handler), and app-settings: is HouseSync's own page in Settings.
      // Android needs native code for that, so it gets the steps instead.
      if (platform === "ios") window.location.href = "app-settings:";
      return;
    }
    setBusy(true);
    try {
      if (mode === "off") {
        await turnOn();
      } else {
        const ok = await switchOn(ALL_PUSH_COLUMNS);
        showToast({
          message: ok ? "All notifications are on" : "Couldn't save that. Try again from Settings.",
        });
      }
    } finally {
      setBusy(false);
      setMode(null);
    }
  }

  if (!mode) return null;
  return (
    <PaymentAlertsCard
      mode={mode}
      platform={platform}
      recent={recent}
      offTypes={offTypes}
      busy={busy}
      panelRef={panelRef}
      onPrimary={() => void primary()}
      onSecondary={close}
    />
  );
}

function Row({ tone, label, children }: { tone: "mint" | "amber" | "brand"; label: string; children: React.ReactNode }) {
  const tones = {
    mint: "bg-mint-50 text-mint-700",
    amber: "bg-amber-50 text-amber-700",
    brand: "bg-brand-50 text-brand-600",
  } as const;
  return (
    <li className="flex items-center gap-3 px-3.5 py-2.5">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl ${tones[tone]}`}>
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {children}
        </svg>
      </span>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </li>
  );
}

function Bell() {
  return (
    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 20a2 2 0 0 1-3.4 0" />
    </svg>
  );
}

const STEPS: Record<"ios" | "android", string[]> = {
  ios: ["Tap Open Settings below", "Tap Notifications", "Turn on Allow Notifications"],
  android: ["Open your phone's Settings", "Tap Apps, then HouseSync", "Turn on Notifications"],
};

export function PaymentAlertsCard({
  mode,
  platform = "ios",
  recent,
  offTypes = [],
  busy = false,
  panelRef,
  onPrimary,
  onSecondary,
}: {
  mode: PaymentAlertsMode;
  platform?: Platform;
  recent?: RecentPayment | null;
  /** For "partial": the payment notification types switched off, by name. */
  offTypes?: string[];
  busy?: boolean;
  panelRef?: React.Ref<HTMLDivElement>;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const title = mode === "partial" ? "Turn all your notifications on?" : "Don’t miss a payment";
  const android = platform === "android";
  const primaryLabel = busy
    ? "One moment…"
    : mode === "partial"
      ? "Turn them all on"
      : mode === "blocked"
        ? android
          ? "Got it"
          : "Open Settings"
        : "Turn on notifications";
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-alerts-title"
      onClick={onSecondary}
    >
      <div
        ref={panelRef}
        className="card w-full max-w-sm p-6 text-center outline-none"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-600">
          <Bell />
        </div>
        <h2 id="payment-alerts-title" className="mt-3 text-lg font-bold text-slate-900">
          {title}
        </h2>

        {mode === "off" && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            {recent ? (
              <>
                <b className="text-slate-800">{recent.name}</b> paid you back{" "}
                <b className="text-slate-800">{recent.amount}</b> {recent.when}. With notifications on,
                you&apos;d have heard straight away.
              </>
            ) : (
              <>
                Notifications are off {platform === "web" ? "in this browser" : "on this phone"}, so
                payments and bill requests can slip past you.
              </>
            )}
          </p>
        )}
        {mode === "partial" && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            <b className="text-slate-800">{offTypes.join(" and ")}</b>{" "}
            {offTypes.length === 1 ? "is" : "are"} switched off, so a payment could slip past you.
          </p>
        )}
        {mode === "blocked" && (
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Notifications for HouseSync are turned off in your phone&apos;s settings, so payments can
            slip past you.
          </p>
        )}

        {mode !== "blocked" ? (
          <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 text-left">
            <Row tone="mint" label="Someone pays you back">
              <path d="M12 3v12M7 10l5 5 5-5" />
              <path d="M4 21h16" />
            </Row>
            <Row tone="amber" label="A bill needs your share">
              <path d="M5 3h14v18l-3-2-2 2-2-2-2 2-2-2-3 2Z" />
              <path d="M9 8h6M9 12h6" />
            </Row>
            <Row tone="brand" label="A payment needs your confirm">
              <path d="m5 12 4 4 10-10" />
            </Row>
          </ul>
        ) : (
          <ol className="mt-4 space-y-2.5 rounded-2xl border border-slate-100 bg-slate-50 p-3.5 text-left">
            {STEPS[android ? "android" : "ios"].map((step, i) => (
              <li key={step} className="flex items-center gap-3 text-sm font-semibold text-slate-700">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        )}

        <button type="button" onClick={onPrimary} disabled={busy} className="btn-primary btn-block mt-5">
          {primaryLabel}
        </button>
        {!(mode === "blocked" && android) && (
          <button
            type="button"
            onClick={onSecondary}
            disabled={busy}
            className="mx-auto mt-4 block text-sm font-semibold text-slate-400 hover:text-slate-600"
          >
            {mode === "partial" ? "Keep my settings" : "Not now"}
          </button>
        )}
      </div>
    </div>
  );
}
