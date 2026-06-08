// Reasons offered when a user deletes their account. Shared by the settings UI
// (client) and the admin churn report (server), so keep it framework-free.

export const DELETION_REASONS = [
  { code: "not_needed", label: "No longer need it" },
  { code: "not_useful", label: "It wasn't useful" },
  { code: "too_complex", label: "Too complicated to use" },
  { code: "missing_features", label: "Missing features I wanted" },
  { code: "found_alternative", label: "Found a better app" },
  { code: "not_sharing", label: "No longer sharing a house" },
  { code: "other", label: "Other" },
  { code: "prefer_not", label: "Prefer not to say" },
] as const;

export type DeletionReasonCode = (typeof DELETION_REASONS)[number]["code"];

export const DELETION_REASON_CODES: string[] = DELETION_REASONS.map((r) => r.code);

/** Human label for a stored reason code (handles legacy/unknown codes). */
export function deletionReasonLabel(code: string | null | undefined): string {
  if (!code || code === "unspecified") return "Not specified";
  return DELETION_REASONS.find((r) => r.code === code)?.label ?? "Other";
}
