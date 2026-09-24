"use client";

import { useEffect, useState } from "react";
import { InviteBox } from "@/components/house/InviteBox";
import { showToast } from "@/components/app/Toast";

// "1" = the user closed the dashboard card; the House tab keeps the invite.
// Per device on purpose: it's a layout preference, not house data.
const PARK_KEY = "hs_invite_parked";

/**
 * The solo-house invite card on the dashboard. Its corner x hides it here
 * and points at the House tab (which always carries the invite while the
 * house has one member), with a toast so the move is never a mystery.
 */
export function SoloInvite({ code, houseName }: { code: string; houseName: string }) {
  // null until mounted: localStorage isn't there during SSR.
  const [hidden, setHidden] = useState<boolean | null>(null);
  // Post-dismiss callout above the tab bar, arrow on the House tab.
  const [pointing, setPointing] = useState(false);

  useEffect(() => {
    try {
      setHidden(localStorage.getItem(PARK_KEY) === "1");
    } catch {
      setHidden(false);
    }
  }, []);

  function dismiss() {
    try {
      localStorage.setItem(PARK_KEY, "1");
    } catch {
      /* fine: it just shows again next visit */
    }
    setHidden(true);
    // In the apps the nav is the bottom tab bar, so the message can sit just
    // above it and physically point at House. The website's tabs are up top,
    // so it gets the ordinary toast instead of an arrow at nothing.
    if (document.documentElement.classList.contains("native-app")) {
      setPointing(true);
      window.setTimeout(() => setPointing(false), 5200);
    } else {
      // Short enough to never truncate in the toast's single line.
      showToast({ message: "Invite housemates from the House tab." });
    }
  }

  if (hidden === null) return null;

  if (hidden) {
    if (!pointing) return null;
    return (
      <div
        className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-[95] px-4"
        role="status"
        aria-live="polite"
      >
        <button
          type="button"
          onClick={() => setPointing(false)}
          className="relative mx-auto flex w-full max-w-md items-center justify-center rounded-2xl bg-[#0f172a] px-4 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-white/10"
        >
          Invite housemates from the House tab.
          {/* Arrow tip on the House tab: 4th of 5 equal slots, centre at 70%. */}
          <span
            aria-hidden="true"
            className="absolute -bottom-1.5 left-[calc(70%+6px)] h-3 w-3 -translate-x-1/2 rotate-45 bg-[#0f172a]"
          />
        </button>
      </div>
    );
  }

  return (
    <section className="card relative space-y-3 p-4">
      <button
        type="button"
        aria-label="Hide this. Inviting stays on the House tab."
        title="Hide this"
        onClick={dismiss}
        className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/[0.06]"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M6 6l12 12M18 6 6 18" />
        </svg>
      </button>
      <div className="pr-8">
        <h2 className="text-sm font-semibold text-slate-900">Invite your housemates</h2>
        <p className="mt-1 text-sm leading-relaxed text-slate-500">
          {houseName} is just you so far. Add the others and HouseSync starts splitting
          everything between you.
        </p>
      </div>
      <InviteBox code={code} houseName={houseName} />
    </section>
  );
}
