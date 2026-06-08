import "server-only";

// Transactional email via Brevo's HTTP API. Server-only — the API key must
// never reach the browser.

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
const FROM_EMAIL = process.env.REMINDER_FROM_EMAIL ?? "hello@housesync.co.uk";
const FROM_NAME = "HouseSync";
const REPLY_TO = process.env.REMINDER_REPLY_TO ?? "hellohousesync@outlook.com";

export const isEmailConfigured = Boolean(BREVO_API_KEY);

export async function sendEmail({
  to,
  toName,
  subject,
  html,
}: {
  to: string;
  toName?: string;
  subject: string;
  html: string;
}) {
  if (!isEmailConfigured) throw new Error("BREVO_API_KEY is not set");

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
      to: [{ email: to, name: toName }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brevo ${res.status}: ${txt}`);
  }
  return res.json();
}

/** Wrap email body content in a simple branded layout. */
export function emailLayout(
  body: string,
  footer = "You're receiving this because email reminders are on for your HouseSync account. You can turn them off anytime in Settings.",
): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:8px;color:#15151c;font-size:15px;line-height:1.5">
    <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="color:#94a3b8;font-size:12px">${footer}</p>
  </div>`;
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
    <h1 style="font-size:20px;margin:0 0 10px">Welcome to HouseSync, ${escapeHtml(first)} 👋</h1>
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
    <p style="margin-top:18px">Got a question? Just reply to this email — we're happy to help.</p>
    <p>— The HouseSync team</p>`;
  await sendEmail({
    to,
    toName: name ?? undefined,
    subject: "Welcome to HouseSync 🏡",
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
    <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br><a href="${url}" style="color:#6f53f5;word-break:break-all">${url}</a></p>
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
