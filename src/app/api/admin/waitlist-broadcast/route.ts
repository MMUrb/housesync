import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { emailLayout, isEmailConfigured, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

// Admin-only: send a one-off message to everyone on the waitlist. Each person
// gets their own email (no shared To: line). Best-effort per recipient.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isAdminEmail(user.email) || !(await hasAdminSession(user.id))) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  if (!isEmailConfigured) {
    return NextResponse.json({ error: "Email isn't configured (BREVO_API_KEY)." }, { status: 503 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Service role isn't configured." }, { status: 503 });
  }

  let subject = "";
  let message = "";
  try {
    const b = await request.json();
    if (typeof b?.subject === "string") subject = b.subject.trim();
    if (typeof b?.message === "string") message = b.message.trim();
  } catch {
    /* ignore */
  }
  if (!subject || !message) {
    return NextResponse.json({ error: "Subject and message are both required." }, { status: 400 });
  }
  if (subject.length > 200) {
    return NextResponse.json({ error: "Subject is too long (max 200 chars)." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("waitlist")
    .select("email")
    .order("created_at", { ascending: true })
    .limit(5000);
  if (error) {
    return NextResponse.json({ error: "Couldn't load the waitlist." }, { status: 500 });
  }

  const emails = ((data ?? []) as { email: string }[]).map((r) => r.email).filter(Boolean);
  if (emails.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, total: 0 });
  }

  // Build the HTML once; the recipient is set per-send. Admin-authored text is
  // escaped, with blank lines → paragraphs and single newlines → <br>.
  const htmlBody = escapeHtml(message)
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br>")}</p>`)
    .join("");
  const html = emailLayout(
    htmlBody,
    "You're receiving this because you joined the HouseSync waitlist at housesync.co.uk.",
  );

  // Send in small concurrent batches so we don't hammer Brevo or blow the
  // function timeout on a long sequential loop.
  let sent = 0;
  let failed = 0;
  const BATCH = 8;
  for (let i = 0; i < emails.length; i += BATCH) {
    const slice = emails.slice(i, i + BATCH);
    const results = await Promise.allSettled(slice.map((to) => sendEmail({ to, subject, html })));
    for (const r of results) {
      if (r.status === "fulfilled") sent++;
      else failed++;
    }
  }

  // Record when the waitlist was last contacted.
  await admin
    .from("waitlist")
    .update({ notified_at: new Date().toISOString() })
    .not("email", "is", null);

  return NextResponse.json({ ok: true, sent, failed, total: emails.length });
}
