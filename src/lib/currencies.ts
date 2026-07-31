// Currencies offered in the app's pickers (a person's personal display currency
// and the house's base currency). Covers the majors plus the biggest
// international-student markets; the FX source (open.er-api.com) supports all of
// these. Codes are ISO 4217 so Intl.NumberFormat renders the correct symbol.

/** Shown at the top of every picker, in this order — the common cases. */
const PINNED = ["GBP", "USD", "AUD"];

const ALL: { code: string; name: string }[] = [
  { code: "AED", name: "UAE Dirham" },
  { code: "AUD", name: "Australian Dollar" },
  { code: "BDT", name: "Bangladeshi Taka" },
  { code: "BRL", name: "Brazilian Real" },
  { code: "CAD", name: "Canadian Dollar" },
  { code: "CHF", name: "Swiss Franc" },
  { code: "CNY", name: "Chinese Yuan" },
  { code: "DKK", name: "Danish Krone" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British Pound" },
  { code: "GHS", name: "Ghanaian Cedi" },
  { code: "HKD", name: "Hong Kong Dollar" },
  { code: "INR", name: "Indian Rupee" },
  { code: "JPY", name: "Japanese Yen" },
  { code: "KES", name: "Kenyan Shilling" },
  { code: "KRW", name: "South Korean Won" },
  { code: "MXN", name: "Mexican Peso" },
  { code: "MYR", name: "Malaysian Ringgit" },
  { code: "NGN", name: "Nigerian Naira" },
  { code: "NOK", name: "Norwegian Krone" },
  { code: "NZD", name: "New Zealand Dollar" },
  { code: "PKR", name: "Pakistani Rupee" },
  { code: "PLN", name: "Polish Zloty" },
  { code: "QAR", name: "Qatari Riyal" },
  { code: "SAR", name: "Saudi Riyal" },
  { code: "SEK", name: "Swedish Krona" },
  { code: "SGD", name: "Singapore Dollar" },
  { code: "THB", name: "Thai Baht" },
  { code: "TRY", name: "Turkish Lira" },
  { code: "USD", name: "US Dollar" },
  { code: "ZAR", name: "South African Rand" },
];

// Pinned three first, then everything else A-Z by name. Sorting here (rather
// than by hand) keeps the list ordered when currencies are added later.
export const CURRENCIES: { code: string; name: string }[] = [
  ...PINNED.map((code) => ALL.find((c) => c.code === code)).filter(
    (c): c is { code: string; name: string } => Boolean(c),
  ),
  ...ALL.filter((c) => !PINNED.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name)),
];

// Human label for a stored code, falling back to the code itself if unknown.
export function currencyName(code: string): string {
  return CURRENCIES.find((c) => c.code === code)?.name ?? code;
}
