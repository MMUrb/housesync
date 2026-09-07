"use client";

import { useEffect, useRef, useState } from "react";

export type ToastOptions = {
  message: string;
  /** Optional action shown on the right, e.g. "Undo". */
  actionLabel?: string;
  onAction?: () => void | Promise<void>;
  /** Defaults to 5 seconds. */
  durationMs?: number;
};

type Item = ToastOptions & { id: number };

// One host per page. The module holds its presenter so any handler can show
// a toast without threading a hook through every component.
let present: ((t: Item) => void) | null = null;
let seq = 0;

/**
 * Brief confirmation at the bottom of the screen, with an optional action.
 * Used to make an undo that already exists visible at the moment it matters
 * (mark as paid, tick a shopping item, finish a chore). One at a time: a new
 * toast replaces the current one. A no-op before the host has mounted.
 */
export function showToast(opts: ToastOptions): void {
  present?.({ ...opts, id: ++seq });
}

export function ToastHost() {
  const [item, setItem] = useState<Item | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    present = setItem;
    return () => {
      present = null;
    };
  }, []);

  useEffect(() => {
    if (!item) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(
      () => setItem((cur) => (cur?.id === item.id ? null : cur)),
      item.durationMs ?? 5000,
    );
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [item]);

  if (!item) return null;

  function act() {
    const fn = item?.onAction;
    setItem(null);
    void fn?.();
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-[95] flex justify-center"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-full bg-[#0f172a] px-4 py-3 text-sm font-medium text-white shadow-lg ring-1 ring-white/10">
        <span className="min-w-0 truncate">{item.message}</span>
        {item.actionLabel && item.onAction && (
          <button type="button" onClick={act} className="shrink-0 font-bold text-mint-300">
            {item.actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
