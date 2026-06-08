"use client";

import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { getSiteUrl } from "@/lib/env";

export function inviteUrl(code: string) {
  return `${getSiteUrl()}/house/join/${code}`;
}

export function InviteBox({ code, houseName }: { code: string; houseName?: string }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const url = inviteUrl(code);
  const message = `Join ${
    houseName ? `"${houseName}"` : "our house"
  } on HouseSync 🏠 We split rent, bills & chores on here — tap to join: ${url}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  async function share() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "Join my house on HouseSync", text: message, url });
        return;
      } catch {
        return; /* user cancelled the share sheet */
      }
    }
    copy();
  }

  return (
    <div className="space-y-3">
      {/* Primary actions */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={share}
          className="btn-primary flex items-center justify-center gap-2 py-2.5"
        >
          <ShareIcon /> Share
        </button>
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 rounded-xl bg-[#25d366] py-2.5 font-semibold text-white transition hover:bg-[#1ebe5b]"
        >
          <WhatsAppIcon /> WhatsApp
        </a>
      </div>

      {/* Copy link */}
      <button
        type="button"
        onClick={copy}
        className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:bg-slate-100"
      >
        <LinkIcon />
        <span className="min-w-0 flex-1 truncate text-sm text-slate-600">{url}</span>
        <span
          className={`shrink-0 text-sm font-semibold ${
            copied ? "text-mint-600" : "text-brand-600"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </span>
      </button>

      {/* QR for scanning in person */}
      <button
        type="button"
        onClick={() => setShowQr((v) => !v)}
        className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
      >
        {showQr ? "Hide QR code" : "📷 Show a QR code to scan in person"}
      </button>
      {showQr && (
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 p-3">
          <div className="shrink-0 rounded-lg bg-white p-2 ring-1 ring-slate-100">
            <QRCodeSVG value={url} size={92} level="M" />
          </div>
          <div className="text-sm">
            <p className="font-semibold text-slate-700">Scan to join</p>
            <p className="mt-0.5 text-slate-500">
              Point any phone camera at this to open the invite.
            </p>
            <p className="mt-1 text-slate-400">
              Code: <span className="font-mono font-semibold text-slate-600">{code}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 16V3M8 7l4-4 4 4" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1" />
      <path d="M15 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" />
    </svg>
  );
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-2-1.2 7.4 7.4 0 0 1-1.4-1.7c-.1-.2 0-.4.1-.5l.4-.4c.1-.2.2-.3.2-.5.1-.2 0-.3 0-.4l-.8-1.9c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3c-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.3 3.9.6.3 1.1.4 1.5.5.6.2 1.1.2 1.6.1.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2-.1-.1-.2-.2-.5-.3z" />
    </svg>
  );
}
