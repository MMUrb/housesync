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

// The exact strings V8 has been server-rendering for en-GB, frozen as data.
// "Sept" is the one to notice: September is the only month whose en-GB
// abbreviation is not the universal three-letter form, and Apple's engines
// have shipped "Sep" instead. Any name Intl produces can differ between the
// server's ICU and the phone's, and one differing letter is a React #418.
const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The calendar date an instant falls on in a timezone, as numbers. Numeric
 * formatToParts values come from IANA timezone data, which every engine
 * shares; only NAMES and patterns come from the locale data engines disagree
 * on, and none are used here.
 */
function calendarOf(d: Date, timeZone: string): { y: number; m: number; day: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    let y = 0,
      m = 0,
      day = 0;
    for (const p of parts) {
      if (p.type === "year") y = Number(p.value);
      else if (p.type === "month") m = Number(p.value);
      else if (p.type === "day") day = Number(p.value);
    }
    return y && m && day ? { y, m, day } : null;
  } catch {
    return null;
  }
}

/**
 * Formats a date IDENTICALLY on every engine, byte for byte.
 *
 * Two lessons are baked in, both learnt from live React #418s on /expenses:
 *
 * 1. Timezone: leaving it unset formats in the runtime's own zone (UTC on
 *    Vercel, the user's zone in the browser), so the server and the phone can
 *    disagree on the DAY. A bare YYYY-MM-DD is therefore treated as a calendar
 *    date (read and shown in UTC, the same everywhere); a real instant is
 *    pinned to house time. An explicit `timeZone` overrides either.
 *
 * 2. Locale data: even with the zone pinned, Intl month and weekday NAMES come
 *    from each engine's own locale tables, and they differ (en-GB September is
 *    "Sept" on the server's V8 but "Sep" on Apple's engines). So the numbers
 *    come from timezone maths and every name comes from the literal tables
 *    above. Intl never chooses a visible string here.
 *
 * Supports the day/month/year/weekday shapes the app uses. Anything fancier
 * (hours, dateStyle) falls back to pinned Intl and must not be rendered by a
 * client component: names in that output are engine-dependent again.
 */
export function formatDate(value: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  const dateOnly = typeof value === "string" && DATE_ONLY.test(value);
  const d =
    typeof value === "string" ? new Date(dateOnly ? `${value}T00:00:00Z` : value) : value;
  if (Number.isNaN(d.getTime())) return "";

  const o = opts ?? { day: "numeric", month: "short" };
  const tz = o.timeZone ?? (dateOnly ? "UTC" : UK_TZ);

  const unsupported =
    o.hour !== undefined ||
    o.minute !== undefined ||
    o.second !== undefined ||
    o.dateStyle !== undefined ||
    o.timeStyle !== undefined ||
    (o.weekday !== undefined && o.weekday !== "short") ||
    o.era !== undefined ||
    o.timeZoneName !== undefined;
  const cal = unsupported ? null : calendarOf(d, tz);
  if (!cal) {
    // Server-side conveniences only; never render this branch in the client.
    return new Intl.DateTimeFormat("en-GB", { ...o, timeZone: tz }).format(d);
  }

  const { y, m, day } = cal;
  // Day-of-week is pure arithmetic on the calendar date: no lookup tables
  // beyond our own literals, no engine involvement.
  const dow = new Date(Date.UTC(y, m - 1, day)).getUTCDay();
  const lead = o.weekday === "short" ? `${WEEKDAYS_SHORT[dow]}, ` : "";

  // All-numeric shapes render the en-GB way: DD/MM/YYYY.
  if (o.month === "2-digit" || o.month === "numeric") {
    const dd = o.day === "numeric" ? String(day) : String(day).padStart(2, "0");
    const mm = o.month === "numeric" ? String(m) : String(m).padStart(2, "0");
    const yy =
      o.year === undefined
        ? ""
        : `/${o.year === "2-digit" ? String(y % 100).padStart(2, "0") : String(y)}`;
    return `${lead}${dd}/${mm}${yy}`;
  }

  const monthName = o.month === "long" ? MONTHS_LONG[m - 1] : MONTHS_SHORT[m - 1];
  const dd = o.day === "2-digit" ? String(day).padStart(2, "0") : String(day);
  const yy =
    o.year === undefined
      ? ""
      : ` ${o.year === "2-digit" ? String(y % 100).padStart(2, "0") : String(y)}`;
  return `${lead}${dd} ${monthName}${yy}`;
}

/**
 * "September 2026" from a month key like "2026-09". Pure string maths on our
 * own tables, so it cannot differ between server and device.
 */
export function formatMonthYear(key: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(key);
  if (!m) return key;
  const name = MONTHS_LONG[Number(m[2]) - 1];
  return name ? `${name} ${m[1]}` : key;
}

/** The current month's full name in house time, from our own tables. */
export function ukMonthLong(d: Date = new Date()): string {
  const cal = calendarOf(d, UK_TZ);
  return cal ? MONTHS_LONG[cal.m - 1] : MONTHS_LONG[d.getUTCMonth()];
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

/** "1st", "2nd", "23rd"... for rent-day copy. */
export function ordinalDay(n: number): string {
  const r10 = n % 10;
  const r100 = n % 100;
  if (r10 === 1 && r100 !== 11) return `${n}st`;
  if (r10 === 2 && r100 !== 12) return `${n}nd`;
  if (r10 === 3 && r100 !== 13) return `${n}rd`;
  return `${n}th`;
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
