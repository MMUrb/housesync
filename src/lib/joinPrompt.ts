/** How long someone is in no house before they're asked to join one. */
export const JOIN_PROMPT_AFTER_DAYS = 3;

/**
 * True once someone has been in no house for JOIN_PROMPT_AFTER_DAYS: counted
 * from when they signed up, or from when they last left (or were removed
 * from) a house, whichever is later. Never straight away, and never on a
 * date that can't be read.
 */
export function joinPromptDue(
  accountCreatedAt: string,
  lastDepartedAt: string | null,
  now: number,
): boolean {
  const since = Math.max(Date.parse(accountCreatedAt), lastDepartedAt ? Date.parse(lastDepartedAt) : 0);
  if (!Number.isFinite(since)) return false;
  return now - since >= JOIN_PROMPT_AFTER_DAYS * 86_400_000;
}
