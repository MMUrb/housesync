"use client";

export type PayHandles = {
  monzo: string | null;
  paypal: string | null;
  revolut: string | null;
};

function cleanHandle(s: string): string {
  return s
    .trim()
    .replace(/^@/, "")
    .replace(/^https?:\/\/[^/]+\//i, "")
    .replace(/\/.*$/, "");
}

/**
 * One-tap pay buttons: Monzo/PayPal/Revolut deep links. With an amount it's
 * pre-filled in the link; without one the links open the person's plain payment
 * page (used on housemate profiles).
 */
export function PayLinks({ pay, amount }: { pay: PayHandles; amount?: number }) {
  const amt = amount != null ? `/${amount.toFixed(2)}` : "";
  const links: { label: string; href: string }[] = [];
  if (pay.monzo) links.push({ label: "Monzo", href: `https://monzo.me/${cleanHandle(pay.monzo)}${amt}` });
  if (pay.paypal) links.push({ label: "PayPal", href: `https://paypal.me/${cleanHandle(pay.paypal)}${amt}` });
  if (pay.revolut) links.push({ label: "Revolut", href: `https://revolut.me/${cleanHandle(pay.revolut)}` });

  if (links.length === 0) return null;

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
    </>
  );
}
