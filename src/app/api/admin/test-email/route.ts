import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { emailLayout, isEmailConfigured, sendEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: send a sample email through the real path (same sender, layout,
// plain-text part) so you can check deliverability / mail-tester score.
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

  let to = "";
  try {
    const body = await request.json();
    if (typeof body?.to === "string") to = body.to.trim();
  } catch {
    /* ignore */
  }
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  }

  const body = `
    <h1 style="font-size:20px;margin:0 0 10px">HouseSync test email</h1>
    <p>This is a deliverability test sent from the HouseSync admin. It mirrors the layout of our real transactional emails (welcome, verification, reminders).</p>
    <p style="margin:18px 0">
      <a href="https://housesync.co.uk" style="display:inline-block;background:#6f53f5;color:#ffffff;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:10px">Visit HouseSync</a>
    </p>
    <p>If you're viewing this in mail-tester.com, check the score and any flagged items.</p>`;

  try {
    await sendEmail({
      to,
      subject: "HouseSync deliverability test",
      html: emailLayout(body, "This is a one-off test email sent from the HouseSync admin."),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Send failed." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
