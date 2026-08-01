"use client";

import { useEffect, useState } from "react";
import { relativeDay, timeAgo } from "@/lib/format";

/**
 * Relative time strings ("today", "5m ago") depend on the VIEWER's clock and
 * timezone, which the server can't know. Rendering them during SSR produced
 * hydration mismatches (React #418) — reliably in the hour after local
 * midnight, when Vercel (UTC) is still on the previous day and the phone
 * isn't, and for far longer in timezones further from UTC.
 *
 * These render the server's best guess, suppress the mismatch, then correct
 * to the viewer's own clock right after hydration. The state deliberately
 * starts null so the post-mount update is always a real change and React
 * actually patches the text.
 */
function useViewerTime(compute: () => string): string {
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    setText(compute());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return text ?? compute();
}

export function RelativeDay({ date, className }: { date: string; className?: string }) {
  const text = useViewerTime(() => relativeDay(date));
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}

export function TimeAgo({ date, className }: { date: string; className?: string }) {
  const text = useViewerTime(() => timeAgo(date));
  return (
    <span className={className} suppressHydrationWarning>
      {text}
    </span>
  );
}
