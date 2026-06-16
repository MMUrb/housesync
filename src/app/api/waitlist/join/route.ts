import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isEmailConfigured, sendWaitlistEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email = "";
  let replaces = "";
  try {
    const body = await request.json();
    if (typeof body?.email === "string") email = body.email.trim().toLowerCase();
    if (typeof body?.replaces === "string") replaces = body.replaces.trim().toLowerCase();
  } catch {
    /* ignore malformed body */
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Throttle by IP so the sign-up endpoint (which sends an email) can't be spammed.
  if (!(await rateLimit(`waitlist:${clientIp(request)}`, 6, 60))) {
    return NextResponse.json(
      { error: "Too many attempts. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let isNew = true;
  if (isAdminConfigured) {
    const admin = createAdminClient();
    const { error } = await admin.from("waitlist").insert({ email, source: "web" });
    if (error) {
      if (error.code === "23505") {
        isNew = false; // already on the list — succeed quietly, don't resend
      } else {
        console.error("waitlist insert failed:", error);
        return NextResponse.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 },
        );
      }
    }
    // If this submission fixes an earlier typo, drop the old (wrong) entry so
    // only the corrected email stays on the list.
    if (replaces && replaces !== email && EMAIL_RE.test(replaces)) {
      await admin.from("waitlist").delete().eq("email", replaces);
    }
  }

  // Only send the confirmation for genuinely new sign-ups (best-effort).
  if (isNew && isEmailConfigured) {
    try {
      await sendWaitlistEmail(email);
    } catch (e) {
      console.error("waitlist email failed:", e);
    }
  }

  return NextResponse.json({ ok: true, already: !isNew });
}
