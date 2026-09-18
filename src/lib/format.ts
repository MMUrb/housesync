// Small formatting helpers shared across the app.

// The app is UK-first, so a real instant is displayed in house time. Pinning it
// means the server and the viewer's device always render the same string, which
// is what keeps hydration intact.
const UK_TZ = "Europe/London";

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

/** A bare calendar date, e.g. an expense's "2026-09-16". */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Formats a date identically on the server and on the viewer's device.
 *
 * Leaving the timezone unset formats in the RUNTIME's zone, which is UTC on
 * Vercel and the user's own zone in the browser. That silently produced two
 * different strings and so a hydration failure (React #418, seen live from
 * iPhones on /expenses): a timestamp at 23:52 UTC renders as 16 Sept on the
 * server and 17 Sept on a British phone, and a plain "2026-09-16" renders as
 * 15 Sept anywhere west of UTC.
 *
 * So: a bare YYYY-MM-DD is a calendar date, not a moment, and is read and
 * written in UTC so it says the same thing everywhere. Anything else is a real
 * instant, pinned to the app's home timezone. Pass an explicit `timeZone` to
 * override either.
 */
export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const dateOnly = typeof value === "string" && DATE_ONLY.test(value);
  const d =
    typeof value === "string" ? new Date(dateOnly ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    ...(opts ?? { day: "numeric", month: "short" }),
    timeZone: opts?.timeZone ?? (dateOnly ? "UTC" : UK_TZ),
  }).format(d);
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

/**
 * Today's date (YYYY-MM-DD) in the app's home timezone. Server pages pass
 * this into client charts so the SSR HTML and the first client render agree
 * (hydration); the client then corrects to the device's own calendar after
 * mount. en-CA is the locale whose date format IS YYYY-MM-DD.
 */
export function ukToday(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: UK_TZ });
}

/**
 * The later of two ISO timestamps, ignoring nulls. Used to combine several
 * weaker "last seen" signals into the best one available, so the result can
 * only ever be more recent than any single source, never less.
 */
export function laterOf(a?: string | null, b?: string | null): string | null {
  if (!a) return b ?? null;
  if (!b) return a;
  return a > b ? a : b;
}
