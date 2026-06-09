import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isEmailConfigured, sendWaitlistEmail } from "@/lib/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  let email = "";
  try {
    const body = await request.json();
    if (typeof body?.email === "string") email = body.email.trim().toLowerCase();
  } catch {
    /* ignore malformed body */
  }

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
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
