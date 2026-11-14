// Emails written in the admin Email tab. Pure (no server-only), so the
// composer's live preview and the sender build the exact same email, and the
// rules are tested.

/**
 * "news": only people with email on AND "News from HouseSync" on (Settings),
 * always with an unsubscribe link. "service": everyone, for things they must
 * know (changes to the terms, the service itself); never for promotion.
 */
export type BroadcastKind = "news" | "service";

export type Person = {
  id: string;
  /** The email they signed up with. */
  email: string | null;
  name: string | null;
  house: string | null;
  /** The master "Email reminders" switch. */
  emailOn: boolean;
  /** "News from HouseSync". */
  newsOn: boolean;
};

export function firstNameOf(p: Pick<Person, "name">): string {
  return (p.name ?? "").trim().split(/\s+/)[0] || "there";
}

/** Fills {first name} (any spacing or case) with the person's first name. */
export function personalise(text: string, firstName: string): string {
  return text.replace(/\{\s*first\s*name\s*\}/gi, firstName);
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/**
 * Plain text as email HTML: everything escaped (the message can't inject
 * markup), a blank line starts a new paragraph, a single line break stays a
 * line break, and web addresses become links.
 */
export function bodyToHtml(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((para) => {
      const html = escapeHtml(para)
        .replace(/https?:\/\/[^\s<]+[^\s<.,!?;:)]/g, (url) => `<a href="${url}" style="color:#5f3fe0">${url}</a>`)
        .replace(/\n/g, "<br>");
      return `<p style="margin:0 0 14px">${html}</p>`;
    })
    .join("");
}

export function canReceive(p: Person, kind: BroadcastKind): boolean {
  if (!p.email) return false;
  return kind === "service" ? true : p.emailOn && p.newsOn;
}

/**
 * Who an email goes to. `ids` null means everyone allowed; otherwise only the
 * chosen people who are allowed (a chosen person who switched News off is
 * still skipped: their choice wins over the pick).
 */
export function pickRecipients(
  people: Person[],
  kind: BroadcastKind,
  ids: readonly string[] | null,
): Person[] {
  const chosen = ids ? new Set(ids) : null;
  return people.filter((p) => canReceive(p, kind) && (!chosen || chosen.has(p.id)));
}

export const MAX_SUBJECT = 150;
export const MAX_BODY = 10_000;
