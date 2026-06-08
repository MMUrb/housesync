import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured, sendWelcomeEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

// Sends the one-time welcome email to the signed-in user. Idempotent: it marks
// profiles.welcomed_at so it only ever sends once, even if called again.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isEmailConfigured) {
    return NextResponse.json({ ok: true, skipped: "email-not-configured" });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name, welcomed_at")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.welcomed_at) {
    return NextResponse.json({ ok: true, skipped: "already-welcomed" });
  }

  try {
    await sendWelcomeEmail(user.email, (profile as { name: string | null } | null)?.name ?? null);
    // Mark as welcomed only after a successful send.
    await supabase.from("profiles").update({ welcomed_at: new Date().toISOString() }).eq("id", user.id);
  } catch (e) {
    console.error("welcome email failed:", e);
    return NextResponse.json({ ok: false }, { status: 200 }); // best-effort, never block signup
  }

  return NextResponse.json({ ok: true });
}
