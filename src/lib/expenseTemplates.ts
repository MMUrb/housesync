// One-tap starters for a house's first expenses. Each maps to a default
// category every house is created with; the chip's emoji is resolved from the
// house's own category set at render time. Tapping one opens the add-expense
// form via the existing prefill params (title + category), which already
// focus the amount field, so the whole journey is tap, type amount, save.
export const EXPENSE_TEMPLATES: { title: string; category: string }[] = [
  { title: "Rent", category: "rent" },
  { title: "Energy", category: "bills" },
  { title: "Wi-Fi", category: "bills" },
  { title: "Big shop", category: "groceries" },
  { title: "Cleaning stuff", category: "cleaning" },
];

/** Templates not yet used, matched loosely against existing expense titles. */
export function unusedTemplates(existingTitles: string[]): typeof EXPENSE_TEMPLATES {
  const seen = new Set(existingTitles.map((t) => t.trim().toLowerCase()));
  return EXPENSE_TEMPLATES.filter((t) => !seen.has(t.title.toLowerCase()));
}
