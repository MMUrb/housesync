// Stored colours (profiles.avatar_color, house_categories.color) end up in
// style attributes, and React only escapes them as text: a value such as
// "red;position:fixed;inset:0;background:url(...)" adds whole declarations to
// the server-rendered HTML. So only a plain six-digit hex colour is ever
// drawn. Migration 0048 holds the database to the same shape.

export const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** The colour if it's a plain #rrggbb, else the fallback. */
export function safeColor(value: unknown, fallback = "#6f53f5"): string {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}
