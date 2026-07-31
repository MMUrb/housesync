"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// Instagram-style pull-to-refresh, native apps only (mobile browsers already
// have their own, and desktop has no touch pull). Pull down from the top of a
// page: a floating indicator follows the drag, and releasing past the
// threshold soft-refreshes the route — Next re-fetches the server data for
// this screen without a full page reload, so it lands in well under a second.
const THRESHOLD = 70; // px of (eased) pull that arms the refresh
const MAX_PULL = 104;

export function PullToRefresh() {
  const router = useRouter();
  const [native, setNative] = useState(false);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const refreshingRef = useRef(false);
  const startedAtRef = useRef(0);

  useEffect(() => {
    import("@capacitor/core")
      .then(({ Capacitor }) => {
        if (Capacitor.isNativePlatform()) setNative(true);
      })
      .catch(() => {});
  }, []);

  // Collapse once the route data has re-fetched (min spin so it never blinks).
  useEffect(() => {
    if (!refreshingRef.current || isPending) return;
    const minSpin = 500;
    const wait = Math.max(0, minSpin - (Date.now() - startedAtRef.current));
    const t = setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
      pullRef.current = 0;
    }, wait);
    return () => clearTimeout(t);
  }, [isPending]);

  // Failsafe: whatever happens to the transition (offline, hung request),
  // the spinner never sticks around longer than 8s.
  useEffect(() => {
    if (!refreshing) return;
    const t = setTimeout(() => {
      refreshingRef.current = false;
      setRefreshing(false);
      setPull(0);
      pullRef.current = 0;
    }, 8000);
    return () => clearTimeout(t);
  }, [refreshing]);

  useEffect(() => {
    if (!native) return;

    // Don't hijack a drag that an inner scroller (e.g. the chat thread)
    // should own: only engage when nothing above the touch is mid-scroll.
    function innerScrollerNotAtTop(el: Element | null): boolean {
      while (el && el !== document.body) {
        const s = el as HTMLElement;
        if (s.scrollHeight > s.clientHeight + 1) {
          const oy = getComputedStyle(s).overflowY;
          if ((oy === "auto" || oy === "scroll") && s.scrollTop > 0) return true;
        }
        el = el.parentElement;
      }
      return false;
    }

    function onStart(e: TouchEvent) {
      if (e.touches.length > 1) {
        startYRef.current = null;
        return;
      }
      if (refreshingRef.current || window.scrollY > 0) return;
      if (innerScrollerNotAtTop(e.target as Element)) return;
      startYRef.current = e.touches[0].clientY;
    }

    function onMove(e: TouchEvent) {
      if (e.touches.length > 1) {
        startYRef.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      if (startYRef.current == null || refreshingRef.current) return;
      if (window.scrollY > 0) {
        startYRef.current = null;
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        pullRef.current = 0;
        setPull(0);
        return;
      }
      const eased = Math.min(MAX_PULL, dy * 0.45); // resistance, like the real thing
      pullRef.current = eased;
      setPull(eased);
    }

    function onEnd() {
      if (startYRef.current == null) return;
      startYRef.current = null;
      if (refreshingRef.current) return;
      if (pullRef.current >= THRESHOLD) {
        refreshingRef.current = true;
        startedAtRef.current = Date.now();
        setRefreshing(true);
        setPull(THRESHOLD);
        pullRef.current = THRESHOLD;
        // A tiny tick so it feels mechanical (plugin ships in the binaries).
        import("@capacitor/haptics")
          .then(({ Haptics, ImpactStyle }) => Haptics.impact({ style: ImpactStyle.Light }))
          .catch(() => {});
        startTransition(() => router.refresh());
      } else {
        pullRef.current = 0;
        setPull(0);
      }
    }

    // Passive listeners: we never block scrolling, just observe it.
    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [native]);

  if (!native || (pull <= 0 && !refreshing)) return null;

  const progress = Math.min(1, pull / THRESHOLD);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed left-1/2 z-40"
      style={{
        top: "calc(env(safe-area-inset-top) + 66px)",
        transform: `translate(-50%, ${pull - 44}px)`,
        transition: refreshing || pull === 0 ? "transform 200ms ease" : "none",
      }}
    >
      <span
        className="grid h-10 w-10 place-items-center rounded-full bg-white text-brand-600 shadow-soft ring-1 ring-slate-100 dark:bg-[#1b1b33] dark:ring-white/10"
        style={{ opacity: refreshing ? 1 : 0.35 + progress * 0.65 }}
      >
        <svg
          viewBox="0 0 24 24"
          className={`h-5 w-5 ${refreshing ? "animate-spin" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        >
          <path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1" />
          <path d="M20.5 3.5v3.6h-3.6" />
        </svg>
      </span>
    </div>
  );
}
