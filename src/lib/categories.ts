// Category display helpers. Categories are now per-house (the house_categories
// table); these defaults are the seed set + a fallback for any legacy/unknown
// code so display never breaks.

export type CatMeta = { code: string; name: string; emoji: string; color: string };

export const DEFAULT_CATEGORIES: CatMeta[] = [
  { code: "rent", name: "Rent", emoji: "🏠", color: "#6f53f5" },
  { code: "bills", name: "Bills", emoji: "💡", color: "#3f9fe0" },
  { code: "groceries", name: "Groceries", emoji: "🛒", color: "#1bb27e" },
  { code: "streaming", name: "Streaming services", emoji: "🎬", color: "#e0567f" },
  { code: "cleaning", name: "Cleaning", emoji: "🧽", color: "#e0b53f" },
  { code: "furniture", name: "Furniture", emoji: "🛋️", color: "#9b5fe0" },
  { code: "other", name: "Other", emoji: "📦", color: "#94a3b8" },
];

/**
 * Build a code -> meta resolver from a house's categories. Falls back to the
 * defaults (and then a generic "other") so an expense with an unknown code
 * still renders sensibly.
 */
export function buildCatLookup(
  cats: { code: string; name: string; emoji: string; color: string }[],
): (code: string) => CatMeta {
  const map = new Map<string, CatMeta>(cats.map((c) => [c.code, c]));
  for (const d of DEFAULT_CATEGORIES) if (!map.has(d.code)) map.set(d.code, d);
  return (code: string) => map.get(code) ?? { code, name: code, emoji: "📦", color: "#94a3b8" };
}
