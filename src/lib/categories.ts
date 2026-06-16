import { EXPENSE_CATEGORIES } from "@/lib/types";

// Colours + labels for expense categories, shared by the dashboard spending
// views. (Custom/renamed categories will extend these later.)
export const CATEGORY_COLOR: Record<string, string> = {
  rent: "#6f53f5",
  bills: "#3f9fe0",
  groceries: "#1bb27e",
  cleaning: "#e0b53f",
  furniture: "#e0567f",
  other: "#94a3b8",
};

const LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label]),
);

export const catColor = (code: string): string => CATEGORY_COLOR[code] ?? "#94a3b8";
export const catLabel = (code: string): string => LABELS[code] ?? code;
