// Small formatting helpers shared across the app.

const CURRENCY_LOCALE: Record<string, string> = {
  GBP: "en-GB",
  EUR: "en-IE",
  USD: "en-US",
};

export function formatMoney(amount: number, currency = "GBP"): string {
  const locale = CURRENCY_LOCALE[currency] ?? "en-GB";
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

export function currencySymbol(currency = "GBP"): string {
  const map: Record<string, string> = { GBP: "£", EUR: "€", USD: "$" };
  return map[currency] ?? currency;
}

/**
 * Secondary "≈ $63.00" string in the viewer's own currency, or null when there
 * is nothing to add (no display currency set, it matches the house currency, or
 * no rate is available). `display.rate` converts 1 unit of the house currency
 * into the display currency.
 */
export function formatConverted(
  amount: number,
  houseCurrency: string,
  display: { currency: string; rate: number } | null | undefined,
): string | null {
  if (!display || !display.rate || display.currency === houseCurrency) return null;
  return `≈ ${formatMoney(amount * display.rate, display.currency)}`;
}

export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", opts ?? { day: "numeric", month: "short" }).format(d);
}

/** "in 3 days", "tomorrow", "2 days ago", "today". */
export function relativeDay(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "tomorrow";
  if (diffDays === -1) return "yesterday";
  if (diffDays > 1) return `in ${diffDays} days`;
  return `${Math.abs(diffDays)} days ago`;
}

/** Short relative time for activity feeds: "just now", "5m", "3h", "2d". */
export function timeAgo(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(d, { day: "numeric", month: "short" });
}

export function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

export function firstName(name?: string | null): string {
  if (!name) return "there";
  return name.trim().split(/\s+/)[0];
}
