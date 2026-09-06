"use client";

import { useEffect, useRef, useState } from "react";
import { lockScroll, onHardwareBack } from "@/lib/launchPrompts";

export type ConfirmOptions = {
  /** The question, as one short sentence. */
  title: string;
  /** What happens if they go ahead. */
  body?: string;
  /** Names the action ("Delete"), never "OK". */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red for anything that deletes or cannot be undone, purple otherwise. */
  tone?: "brand" | "danger";
};

type Request = { opts: ConfirmOptions; resolve: (ok: boolean) => void };

// One host per page. The module holds its presenter so any event handler
// can ask a question without threading a hook through every component.
let present: ((r: Request) => void) | null = null;

/**
 * Drop-in for window.confirm(). Resolves true when they confirm and false
 * for Cancel, the backdrop, Escape or Android back.
 *
 * The native dialog is what this replaces: inside the apps it renders as a
 * bare OS alert, headed "housesync.co.uk says" on Android. If no ConfirmHost
 * is mounted it still falls back to that dialog, so a missing host degrades
 * to the old look rather than silently skipping the question.
 */
export function confirmSheet(opts: ConfirmOptions): Promise<boolean> {
  if (!present) {
    const text = [opts.title, opts.body].filter(Boolean).join("\n\n");
    return Promise.resolve(typeof window !== "undefined" && window.confirm(text));
  }
  const ask = present;
  return new Promise((resolve) => ask({ opts, resolve }));
}

/**
 * The sheet is the iOS action-sheet shape, which is what the phone itself
 * shows for exactly these questions: a message bar with the action as a
 * full-width row, then Cancel alone in its own pill with a gap between. No
 * side-by-side buttons and no outlines; every label is a full-width flex row,
 * so nothing can sit off-centre. On wider screens the same two bars are
 * centred instead of anchored to the bottom.
 */
export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);
  // The live request lives in a ref so resolving it never happens inside a
  // state updater (which React may run twice in development).
  const live = useRef<Request | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    present = (next) => {
      // A second question while one is open replaces it; the first reads as declined.
      live.current?.resolve(false);
      live.current = next;
      setReq(next);
    };
    return () => {
      present = null;
    };
  }, []);

  function answer(ok: boolean) {
    const cur = live.current;
    live.current = null;
    setReq(null);
    cur?.resolve(ok);
  }

  useEffect(() => {
    if (!req) return;
    const unlock = lockScroll();
    const offBack = onHardwareBack(() => answer(false));
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") answer(false);
    };
    window.addEventListener("keydown", onKey);
    // Cancel takes focus, so a stray Enter never confirms something destructive.
    cancelRef.current?.focus();
    return () => {
      unlock();
      offBack();
      window.removeEventListener("keydown", onKey);
    };
  }, [req]);

  if (!req) return null;
  const { title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", tone = "brand" } = req.opts;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center px-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom))] sm:items-center sm:px-4 sm:pb-0"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-sheet-title"
      aria-describedby={body ? "confirm-sheet-body" : undefined}
    >
      <button
        type="button"
        aria-label={cancelLabel}
        onClick={() => answer(false)}
        className="absolute inset-0 bg-slate-900/45"
      />
      <div className="relative w-full max-w-[360px]">
        <div className="card overflow-hidden">
          <div className="px-4 pb-3 pt-3.5 text-center">
            <h2 id="confirm-sheet-title" className="text-[15px] font-semibold leading-snug text-slate-900">
              {title}
            </h2>
            {body && (
              <p id="confirm-sheet-body" className="mt-1 text-[13px] leading-relaxed text-slate-600">
                {body}
              </p>
            )}
          </div>
          <div className="h-px bg-slate-200 dark:bg-white/10" />
          <button
            type="button"
            onClick={() => answer(true)}
            className={`flex h-[50px] w-full items-center justify-center text-[16px] font-semibold tracking-[-0.01em] active:bg-slate-50 dark:active:bg-white/[0.06] ${
              tone === "danger" ? "text-red-600" : "text-brand-600"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
        <button
          ref={cancelRef}
          type="button"
          onClick={() => answer(false)}
          className="card mt-2 flex h-[50px] w-full items-center justify-center rounded-full text-[16px] font-semibold tracking-[-0.01em] text-slate-900 active:bg-slate-50 dark:active:bg-white/[0.06]"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}
