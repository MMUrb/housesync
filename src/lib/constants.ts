// Shared constants safe to import from both server and client code.

export const ACTIVE_HOUSE_COOKIE = "hs_active_house";

/** Base path for the (hidden) admin area. The route folder name must match. */
export const ADMIN_BASE = "/hq-k4p9";

/**
 * Longest a house name can be. It appears in the header (beside the switcher),
 * the switcher list, chat notices and every export, so it has to stay short
 * enough not to wreck those layouts. Enforced on both name inputs and by a
 * check constraint in the database (migration 0037).
 */
export const HOUSE_NAME_MAX = 30;

/** Preset avatar colours (matches the palette seeded in schema.sql). */
export const AVATAR_COLORS = [
  "#6f53f5",
  "#1bb27e",
  "#f5953f",
  "#e0567f",
  "#3f9fe0",
  "#9b5fe0",
  "#e0b53f",
  "#3fcdad",
];
