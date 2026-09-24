"use client";

import { useEffect, useRef, useState } from "react";
import { formatMoney } from "@/lib/format";

/**
 * A money amount that rolls to its value: from zero on first paint, and from
 * the previous amount whenever the value changes. Money that visibly arrives
 * at its number reads as computed, not asserted. Renders the final value on
 * the server and stands down entirely for prefers-reduced-motion.
 */
export function CountUp({
  value,
  currency,
  durationMs = 620,
}: {
  value: number;
  currency: string;
  durationMs?: number;
}) {
  const [shown, setShown] = useState(value);
  const fromRef = useRef(0); // roll from 0 on mount, then from the last value
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    fromRef.current = value;
    if (reduced || from === value) {
      setShown(value);
      return;
    }
    const t0 = performance.now();
    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    const frame = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      setShown(from + (value - from) * ease(p));
      if (p < 1) rafRef.current = requestAnimationFrame(frame);
    };
    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  return <span className="tabular-nums">{formatMoney(shown, currency)}</span>;
}
