import "server-only";

// Transactional SMS via Brevo's HTTP API. Server-only (uses the secret API key).
// Note: SMS requires SMS credits on your Brevo account (unlike email).

const BREVO_API_KEY = process.env.BREVO_API_KEY ?? "";
// Alphanumeric sender, max 11 chars (some countries require registration).
const SMS_SENDER = (process.env.SMS_SENDER ?? "HouseSync").slice(0, 11);

export const isSmsConfigured = Boolean(BREVO_API_KEY);

export async function sendSms({ to, content }: { to: string; content: string }) {
  if (!isSmsConfigured) throw new Error("BREVO_API_KEY is not set");

  const res = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", {
    method: "POST",
    headers: {
      "api-key": BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      type: "transactional",
      sender: SMS_SENDER,
      // Brevo wants the number with country code but WITHOUT the leading "+".
      recipient: to.replace(/^\+/, ""),
      content,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Brevo SMS ${res.status}: ${txt}`);
  }
  return res.json();
}
