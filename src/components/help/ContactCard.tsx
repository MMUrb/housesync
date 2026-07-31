"use client";

import { useEffect, useState } from "react";

const EMAIL = "hello@housesync.co.uk";
const SUBJECT = "HouseSync help";
const INSTAGRAM_URL = "https://www.instagram.com/housesync.co.uk/";

// Where "Email us" can send people. Each option tries the NATIVE app's URL
// scheme first (googlegmail:// etc.) and falls back to web compose if the app
// doesn't take over — so phones open the app, and devices without it still
// get a compose window instead of a dead tap. A bare mailto: alone silently
// does nothing when no mail app is configured — that was the original bug.
const MAIL_OPTIONS: {
  key: string;
  label: string;
  hint: string;
  href: string;
  appHref?: string;
  external: boolean;
  tile: string;
  glyph: React.ReactNode;
}[] = [
  {
    key: "gmail",
    label: "Gmail",
    hint: "Opens the Gmail app",
    href: `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(EMAIL)}&su=${encodeURIComponent(SUBJECT)}`,
    appHref: `googlegmail://co?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}`,
    external: true,
    tile: "bg-red-50 text-red-600 dark:bg-red-500/15",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M3 6.5v11c0 .55.45 1 1 1h2.5v-7.2l5.5 4.1 5.5-4.1v7.2H20c.55 0 1-.45 1-1v-11c0-1-1.15-1.55-1.92-.94L12 10.9 4.92 5.56C4.15 4.95 3 5.5 3 6.5z" />
      </svg>
    ),
  },
  {
    key: "outlook",
    label: "Outlook",
    hint: "Opens the Outlook app",
    href: `https://outlook.live.com/mail/0/deeplink/compose?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}`,
    appHref: `ms-outlook://compose?to=${encodeURIComponent(EMAIL)}&subject=${encodeURIComponent(SUBJECT)}`,
    external: true,
    tile: "bg-sky-50 text-sky-600 dark:bg-sky-500/15",
    glyph: (
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor" aria-hidden="true">
        <path d="M13 5.4 21 4v16l-8-1.4V5.4z" opacity=".55" />
        <path d="M3 6.4 12 5v14l-9-1.4V6.4zm4.5 3.1c-1.4 0-2.3 1.1-2.3 2.6s.9 2.6 2.3 2.6 2.3-1.1 2.3-2.6-.9-2.6-2.3-2.6zm0 1.2c.6 0 1 .5 1 1.4s-.4 1.4-1 1.4-1-.5-1-1.4.4-1.4 1-1.4z" />
      </svg>
    ),
  },
  {
    key: "default",
    label: "Your mail app",
    hint: "Apple Mail, Outlook desktop, etc.",
    href: `mailto:${EMAIL}?subject=${encodeURIComponent(SUBJECT)}`,
    external: false,
    tile: "bg-slate-100 text-slate-600 dark:bg-white/10",
    glyph: (
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
        <path d="m3.5 7 8.5 6 8.5-6" />
      </svg>
    ),
  },
];

// Phones (native app or mobile browser) should land in the actual Gmail /
// Outlook app; desktops mostly don't have those apps, so web compose is the
// right destination there.
function isMobileLike(): boolean {
  return typeof navigator !== "undefined" && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

// Try the app's URL scheme; if the app didn't take over the screen shortly
// after (not installed), open the web compose instead so the tap never dies.
function openAppOrWeb(appHref: string, webHref: string) {
  window.location.href = appHref;
  setTimeout(() => {
    if (document.visibilityState === "visible") {
      window.open(webHref, "_blank", "noopener,noreferrer");
    }
  }, 1200);
}

// "Still need a hand?" card on the Help page. On phones, "Email us" goes
// STRAIGHT to the default mail app (mailto — the OS picks Gmail/Outlook/Mail,
// whatever the user chose as default); the chooser only appears if nothing
// handles it. On desktop, where mailto often has no handler, the chooser
// opens immediately. Instagram DMs are the second route.
export function ContactCard() {
  const [picking, setPicking] = useState(false);

  function onEmailClick() {
    if (!isMobileLike()) {
      setPicking(true);
      return;
    }
    // Phone: hand straight to the default mail app.
    window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(SUBJECT)}`;
    // Rescue: if no mail app took over (page never went hidden), offer the
    // chooser. The wentHidden flag matters because backgrounded webviews can
    // delay timers until we come BACK from the mail app — checking visibility
    // alone at fire time would wrongly pop the chooser on return.
    let wentHidden = false;
    const onVis = () => {
      if (document.visibilityState === "hidden") wentHidden = true;
    };
    document.addEventListener("visibilitychange", onVis);
    setTimeout(() => {
      document.removeEventListener("visibilitychange", onVis);
      if (!wentHidden && document.visibilityState === "visible") setPicking(true);
    }, 1400);
  }

  // Escape closes the picker.
  useEffect(() => {
    if (!picking) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setPicking(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [picking]);

  return (
    <>
      <div className="card p-4">
        <p className="text-sm font-medium text-slate-800">Still need a hand?</p>
        <p className="text-xs text-slate-500">Message us and we&apos;ll get back to you.</p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={onEmailClick}
            className="btn-secondary flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2.5" y="4.5" width="19" height="15" rx="2.5" />
              <path d="m3.5 7 8.5 6 8.5-6" />
            </svg>
            Email us
          </button>
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-secondary flex flex-1 items-center justify-center gap-2 px-3 py-2 text-sm"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              aria-hidden="true"
            >
              <rect x="3" y="3" width="18" height="18" rx="5" />
              <circle cx="12" cy="12" r="3.8" />
              <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
            </svg>
            Instagram
          </a>
        </div>
      </div>

      {picking && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-900/60 px-4 pb-4 backdrop-blur-sm sm:items-center sm:pb-0"
          onClick={() => setPicking(false)}
          role="presentation"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Choose how to email us"
            onClick={(e) => e.stopPropagation()}
            className="card w-full max-w-sm p-5"
          >
            <p className="text-base font-bold text-slate-900">Email us</p>
            <p className="mt-0.5 text-xs text-slate-500">
              No mail app set up? Pick where to write your message. We&apos;ll fill in {EMAIL} for
              you.
            </p>

            <div className="mt-4 space-y-2">
              {MAIL_OPTIONS.map((o) => (
                <a
                  key={o.key}
                  href={o.href}
                  {...(o.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  onClick={(e) => {
                    // Phones: hand off to the actual app, web compose only as
                    // the not-installed fallback. Desktop keeps web compose.
                    if (o.appHref && isMobileLike()) {
                      e.preventDefault();
                      openAppOrWeb(o.appHref, o.href);
                    }
                    setPicking(false);
                  }}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 p-3 transition hover:bg-slate-50 active:bg-slate-100 dark:border-white/10 dark:hover:bg-white/[0.06] dark:active:bg-white/[0.09]"
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${o.tile}`}>
                    {o.glyph}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{o.label}</span>
                    <span className="block text-[11px] text-slate-400">{o.hint}</span>
                  </span>
                  <span className="shrink-0 text-slate-300">›</span>
                </a>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setPicking(false)}
              className="btn-ghost btn-block mt-3 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </>
  );
}
