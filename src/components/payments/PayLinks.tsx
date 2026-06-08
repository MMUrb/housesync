"use client";

import { useState } from "react";

export type PayHandles = {
  monzo: string | null;
  paypal: string | null;
  revolut: string | null;
  bank: string | null;
};

function cleanHandle(s: string): string {
  return s
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/\/.*$/, "");
}

/** One-tap pay buttons: Monzo/PayPal/Revolut deep links (amount pre-filled) + copy bank details. */
export function PayLinks({ pay, amount }: { pay: PayHandles; amount: number }) {
  const [copied, setCopied] = useState(false);
  const amt = amount.toFixed(2);
  const links: { label: string; href: string }[] = [];
  if (pay.monzo) links.push({ label: "Monzo", href: `https://monzo.me/${cleanHandle(pay.monzo)}/${amt}` });
  if (pay.paypal) links.push({ label: "PayPal", href: `https://paypal.me/${cleanHandle(pay.paypal)}/${amt}` });
  if (pay.revolut) links.push({ label: "Revolut", href: `https://revolut.me/${cleanHandle(pay.revolut)}` });

  async function copyBank() {
    if (!pay.bank) return;
    try {
      await navigator.clipboard.writeText(pay.bank);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  if (links.length === 0 && !pay.bank) return null;

  return (
    <>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-primary px-3 py-1.5 text-xs"
        >
          Pay · {l.label}
        </a>
      ))}
      {pay.bank && (
        <button type="button" onClick={copyBank} className="btn-secondary px-3 py-1.5 text-xs">
          {copied ? "Copied!" : "Bank details"}
        </button>
      )}
    </>
  );
}
