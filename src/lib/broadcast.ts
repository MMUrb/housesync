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

/** "text": typed message, escaped and laid out for you. "html": your own HTML. */
export type BodyFormat = "text" | "html";

/**
 * Removes anything in pasted HTML that could run or embed something: scripts,
 * frames, objects, forms, event-handler attributes and javascript: links.
 * Email apps block these anyway; this keeps them out of the email entirely.
 * Only the admin can write these emails, so it's belt and braces, not the
 * only line of defence (the composer's preview is also a sealed frame).
 */
export function sanitizeEmailHtml(html: string): string {
  return (
    html
      .replace(/<(script|iframe|object|embed|form)\b[\s\S]*?<\/\1\s*>/gi, "")
      .replace(/<(script|iframe|object|embed|form|base|meta|link)\b[^>]*\/?>/gi, "")
      // Attributes are only cleaned INSIDE tags: run over the whole text, the
      // event-handler rule ate ordinary words ("Pay online = easy" -> "Pay").
      .replace(/<[a-zA-Z][^>]*>/g, (tag) =>
        tag
          .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
          .replace(/(href|src)\s*=\s*(["']?)\s*javascript:[^"'\s>]*\2/gi, '$1="#"'),
      )
  );
}

/**
 * Images pasted INTO the HTML (data: URIs) rather than linked. They bloat the
 * email past the size limit and Gmail and Outlook block them anyway; the
 * composer says so and asks for https links instead.
 */
export function hasEmbeddedImages(html: string): boolean {
  return /\bsrc\s*=\s*["']?\s*data:image\//i.test(html) || /url\(\s*["']?data:image\//i.test(html);
}

/** The finished body for one person, in either format. */
export function renderBody(body: string, format: BodyFormat, firstName: string): string {
  if (format === "html") return sanitizeEmailHtml(personalise(body, escapeHtml(firstName)));
  return bodyToHtml(personalise(body, firstName));
}

export const MAX_SUBJECT = 150;
export const MAX_BODY = 10_000;
/** Pasted HTML runs longer (inline styles); still far under any email size limit. */
export const MAX_BODY_HTML = 100_000;
