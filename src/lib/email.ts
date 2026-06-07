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
export function emailLayout(body: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:8px;color:#15151c;font-size:15px;line-height:1.5">
    <div style="font-weight:bold;font-size:18px;margin-bottom:16px">House<span style="color:#5f3fe0">Sync</span></div>
    ${body}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0" />
    <p style="color:#94a3b8;font-size:12px">You're receiving this because email reminders are on for your HouseSync account. You can turn them off anytime in Settings.</p>
  </div>`;
}
