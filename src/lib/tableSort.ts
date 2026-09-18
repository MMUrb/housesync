// Shared sorting behaviour for the admin tables. Pure and dependency-free so
// it can be unit tested: getting the direction backwards is an easy mistake
// and an invisible one until someone clicks.

export type SortDir = "asc" | "desc";
export type SortState = { key: string; dir: SortDir };

/**
 * Columns whose FIRST click should show the newest first. For a date that is
 * nearly always what you want to see; for a name or an email the useful first
 * look is A to Z.
 */
export const NEWEST_FIRST = new Set(["joined", "seen", "created"]);

/**
 * Where clicking a header should take you: flip the column already in charge,
 * otherwise start that column in its own most useful direction.
 */
export function nextSortDir(current: SortState, key: string): SortDir {
  if (current.key === key) return current.dir === "asc" ? "desc" : "asc";
  return NEWEST_FIRST.has(key) ? "desc" : "asc";
}
