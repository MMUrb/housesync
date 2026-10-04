"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { showToast } from "@/components/app/Toast";
import { lockScroll, onHardwareBack } from "@/lib/launchPrompts";
import { registerShareSheet, shareMessage, type SharePayload } from "@/lib/share";

// HouseSync's own share sheet, for computers (lib/share.ts sends phones to
// their own sheet; a phone browser without one gets this, as a bottom sheet
// like the tour). Centred on computers. The usual row of places to send it, the browser's system
// sheet as "More" where it has one, and Copy. A share with no link (just a
// message) skips the public networks and offers WhatsApp, Email and Copy.

type Target = {
  key: string;
  label: string;
  href: string;
  bg: string;
  icon: React.ReactNode;
};

const enc = encodeURIComponent;

function Glyph({ children, fill = true }: { children: React.ReactNode; fill?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-[22px] w-[22px]"
      fill={fill ? "currentColor" : "none"}
      stroke={fill ? undefined : "currentColor"}
      strokeWidth={fill ? undefined : 1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function targetsFor(p: SharePayload): Target[] {
  const message = shareMessage(p);
  const list: Target[] = [
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${enc(message)}`,
      bg: "#25D366",
      icon: (
        <Glyph>
          <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.2.2-.3.2-.5.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.3 3.9.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.5-.3z" />
        </Glyph>
      ),
    },
  ];
  if (p.url) {
    list.push(
      {
        key: "facebook",
        label: "Facebook",
        href: `https://www.facebook.com/sharer/sharer.php?u=${enc(p.url)}`,
        bg: "#1877F2",
        icon: (
          <Glyph>
            <path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21z" />
          </Glyph>
        ),
      },
      {
        key: "x",
        label: "X",
        href: `https://x.com/intent/post?text=${enc(p.text)}&url=${enc(p.url)}`,
        bg: "#0f1419",
        icon: (
          <Glyph>
            <path d="M17.2 3.5h2.9l-6.4 7.3 7.5 9.9h-5.9l-4.6-6-5.3 6H2.5l6.8-7.8L2.1 3.5h6l4.2 5.5zm-1 15.4h1.6L7.9 5.1H6.2z" />
          </Glyph>
        ),
      },
      {
        key: "telegram",
        label: "Telegram",
        href: `https://t.me/share/url?url=${enc(p.url)}&text=${enc(p.text)}`,
        bg: "#2AABEE",
        icon: (
          <Glyph>
            <path d="M20.7 4.2 2.9 11c-1.2.5-1.2 1.2-.2 1.5l4.6 1.4 1.7 5.4c.2.6.4.8.8.8s.6-.2.9-.5l2.3-2.2 4.7 3.5c.9.5 1.5.2 1.7-.8l3.1-14.5c.3-1.3-.5-1.9-1.8-1.4zM9.6 14.1l8.6-7.7c.4-.3-.1-.5-.6-.2l-10.6 6.7" />
          </Glyph>
        ),
      },
    );
  }
  list.push({
    key: "email",
    label: "Email",
    href: `mailto:?subject=${enc(p.title ?? "HouseSync")}&body=${enc(message)}`,
    bg: "#64748b",
    icon: (
      <Glyph fill={false}>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="m4 7 8 6 8-6" />
      </Glyph>
    ),
  });
  return list;
}

export function ShareSheet({ payload, onClose }: { payload: SharePayload; onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [canSystem, setCanSystem] = useState(false);
  const targets = targetsFor(payload);

  useEffect(() => {
    setCanSystem(typeof navigator.share === "function");
    const unlock = lockScroll();
    const offBack = onHardwareBack(onClose);
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    const onKey = (ev: KeyboardEvent) => ev.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      offBack();
      unlock();
      prevFocus?.focus?.();
    };
  }, [onClose]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(payload.url ?? shareMessage(payload));
      showToast({ message: payload.url ? "Link copied" : "Message copied" });
    } catch {
      showToast({ message: "Couldn't copy. Select and copy it from the box above." });
      return;
    }
    onClose();
  }

  async function more() {
    try {
      await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
      onClose();
    } catch {
      /* cancelled: leave this sheet open */
    }
  }

  const tile = "flex flex-col items-center gap-1.5 rounded-2xl py-1 text-center outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
  const label = "text-xs font-semibold text-slate-600";

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-sheet-title"
    >
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-slate-900/55" />
      <div
        ref={panelRef}
        tabIndex={-1}
        className="hs-sheet-up card relative w-full max-w-md rounded-b-none rounded-t-3xl px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] outline-none sm:max-w-sm sm:rounded-3xl sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <h2 id="share-sheet-title" className="text-center text-lg font-bold text-slate-900">
          {payload.dialogTitle ?? "Share"}
        </h2>
        <p className="mt-3 select-text rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-2.5 text-[13px] leading-relaxed text-slate-600 [overflow-wrap:anywhere]">
          {shareMessage(payload)}
        </p>

        <ul className="mt-5 grid grid-cols-4 gap-y-4">
          {targets.map((t) => (
            <li key={t.key}>
              <a
                href={t.href}
                target={t.href.startsWith("mailto:") ? undefined : "_blank"}
                rel="noopener noreferrer"
                onClick={() => setTimeout(onClose, 0)}
                className={tile}
              >
                <span className="grid h-12 w-12 place-items-center rounded-full text-white" style={{ backgroundColor: t.bg }}>
                  {t.icon}
                </span>
                <span className={label}>{t.label}</span>
              </a>
            </li>
          ))}
          {canSystem && (
            <li>
              <button type="button" onClick={more} className={`${tile} w-full`}>
                <span className="grid h-12 w-12 place-items-center rounded-full bg-slate-100 text-slate-600">
                  <Glyph>
                    <circle cx="5.5" cy="12" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="18.5" cy="12" r="1.8" />
                  </Glyph>
                </span>
                <span className={label}>More</span>
              </button>
            </li>
          )}
          <li>
            <button type="button" onClick={copy} className={`${tile} w-full`}>
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-600">
                <Glyph fill={false}>
                  <path d="M9 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
                  <path d="M15 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
                </Glyph>
              </span>
              <span className={label}>{payload.url ? "Copy link" : "Copy"}</span>
            </button>
          </li>
        </ul>

        <button type="button" onClick={onClose} className="btn-secondary btn-block mt-5">
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Mounted once in the app layout; lib/share.ts opens it when needed. */
export function ShareSheetHost() {
  const [payload, setPayload] = useState<SharePayload | null>(null);
  const close = useCallback(() => setPayload(null), []);
  useEffect(() => registerShareSheet(setPayload), []);
  if (!payload) return null;
  return <ShareSheet payload={payload} onClose={close} />;
}
