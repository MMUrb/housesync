import "server-only";

// Transactional email. Prefers Resend (sends links un-wrapped, so it avoids the
// click-tracking redirect Brevo forces — which trips SpamAssassin's URI_PHISH).
// Falls back to Brevo when only BREVO_API_KEY is set, so the cutover is seamless.
// Server-only — the API key must never reach the browser.

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? process.env.REMINDER_FROM_EMAIL ?? "hello@housesync.co.uk";
const FROM_NAME = "HouseSync";
// Must be on the SAME domain as the sender, or SpamAssassin's
// FREEMAIL_FORGED_REPLYTO rule docks ~2.5 points. Make sure this address can
// receive mail (forward hello@housesync.co.uk to wherever you read it).
const REPLY_TO = process.env.EMAIL_REPLY_TO ?? process.env.REMINDER_REPLY_TO ?? "hello@housesync.co.uk";

export const isEmailConfigured = Boolean(RESEND_API_KEY || BREVO_API_KEY);

type SendArgs = {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text?: string;
};

export async function sendEmail({ to, toName, subject, html, text }: SendArgs) {
  if (!isEmailConfigured) {
    throw new Error("No email provider configured (set RESEND_API_KEY)");
  }
  // A matching plain-text part improves deliverability (spam filters penalise
  // HTML-only mail).
  const textContent = text ?? htmlToText(html);
  if (RESEND_API_KEY) return sendViaResend({ to, subject, html, text: textContent });
  return sendViaBrevo({ to, toName, subject, html, text: textContent });
}

async function sendViaResend(args: { to: string; subject: string; html: string; text: string }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [args.to],
      reply_to: REPLY_TO,
      subject: args.subject,
      html: args.html,
      text: args.text,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Resend ${res.status}: ${txt}`);
  }
  return res.json();
}

async function sendViaBrevo(args: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
  text: string;
}) {
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: FROM_EMAIL, name: FROM_NAME },
      replyTo: { email: REPLY_TO, name: FROM_NAME },
      to: [{ email: args.to, name: args.toName }],
      subject: args.subject,
      htmlContent: args.html,
      textContent: args.text,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${txt}`);
  }
  return res.json();
}

/** Crude HTML → text fallback so every email ships with a plain-text part. */
function htmlToText(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "$2 ($1)")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|li|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&rsquo;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Wrap email body content in a simple branded layout. */
export function emailLayout(
  body: string,
  footer = "You're receiving this because email reminders are on for your HouseSync account. You can turn them off anytime in Settings.",
): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>HouseSync</title>
</head>
<body style="margin:0;padding:0;background:#f6f7fb">
<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:16px;color:#15151c;font-size:15px;line-height:1.5">
  <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
  ${body}
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
  <p style="margin:0 0 10px;color:#475569;font-size:13px">Got a question? Send us a message on any of our socials:</p>
  <p style="margin:0 0 16px">
    <a href="https://www.linkedin.com/company/housesyncuk/" style="display:inline-block;margin:0 6px 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">LinkedIn</a>
    <a href="https://www.instagram.com/housesync.uk/" style="display:inline-block;margin:0 6px 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">Instagram</a>
    <a href="https://www.tiktok.com/@housesync.uk" style="display:inline-block;margin:0 0 6px 0;padding:7px 14px;background:#f1f5f9;color:#5f3fe0;text-decoration:none;border-radius:8px;font-size:12px;font-weight:bold">TikTok</a>
  </p>
  <p style="color:#94a3b8;font-size:12px">${footer}</p>
</div>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/** One-time welcome email sent right after a new account is created. */
export async function sendWelcomeEmail(to: string, name?: string | null) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  const body = `
    <h1 style="font-size:20px;margin:0 0 10px">Welcome to HouseSync, ${escapeHtml(first)}</h1>
    <p>Thanks for signing up! HouseSync helps you and your housemates split bills, track chores and stay on top of rent — without the awkward money chats.</p>
    <p style="margin:22px 0">
      <a href="https://housesync.co.uk/dashboard" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Open HouseSync</a>
    </p>
    <p style="font-weight:bold;margin-bottom:6px">Getting started takes two minutes:</p>
    <ol style="padding-left:18px;margin-top:0">
      <li style="margin-bottom:4px">Create your house — or join one with an invite link.</li>
      <li style="margin-bottom:4px">Invite your housemates.</li>
      <li>Add your first bill or expense — we'll split it for you.</li>
    </ol>
    <p style="margin-top:18px">— The HouseSync team</p>`;
  await sendEmail({
    to,
    toName: name ?? undefined,
    subject: "Welcome to HouseSync",
    html: emailLayout(body, "You're receiving this because you just created a HouseSync account."),
  });
}

/** Email-verification link sent when a user taps "Verify now" in Settings. */
export async function sendVerificationEmail(to: string, name: string | null, url: string) {
  const first = (name ?? "").trim().split(/\s+/)[0] || "there";
  const body = `
    <h1 style="font-size:20px;margin:0 0 10px">Verify your email</h1>
    <p>Hi ${escapeHtml(first)}, please confirm this is your email address for HouseSync.</p>
    <p style="margin:22px 0">
      <a href="${url}" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Verify my email</a>
    </p>
    <p style="color:#64748b;font-size:13px;margin-bottom:4px">If the button doesn't work, copy and paste this link into your browser:</p>
    <p style="color:#64748b;font-size:13px;word-break:break-all;margin-top:0">${url}</p>
    <p style="color:#94a3b8;font-size:12px;margin-top:14px">This link expires in 24 hours. If you didn't request it, you can safely ignore this email.</p>`;
  await sendEmail({
    to,
    toName: name ?? undefined,
    subject: "Verify your HouseSync email",
    html: emailLayout(
      body,
      "You're receiving this because someone asked to verify this email for a HouseSync account.",
    ),
  });
}

/** Confirmation email sent when someone joins the pre-launch waitlist. */
export async function sendWaitlistEmail(to: string) {
  const body = `
    <h1 style="font-size:20px;margin:0 0 10px">You're on the list</h1>
    <p>Thanks for joining the HouseSync waitlist! We're putting the finishing touches on the easiest way for UK housemates to split bills, track chores and stay on top of rent — without the awkward money chats.</p>
    <p>You're now in the queue for early access. We'll email you the moment there's an update or your invite is ready — just the important stuff.</p>
    <p style="margin-top:18px">Talk soon,<br>— The HouseSync team</p>`;
  await sendEmail({
    to,
    subject: "You're on the HouseSync waitlist",
    html: emailLayout(
      body,
      "You're receiving this because you joined the HouseSync waitlist at housesync.co.uk.",
    ),
  });
}
