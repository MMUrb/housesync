import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { DELETION_REASON_CODES } from "@/lib/deletion";

export const dynamic = "force-dynamic";

// Permanently deletes the signed-in user's own account. Deleting an auth user
// needs the service-role key, so it runs here on the server (never the browser).
// ON DELETE CASCADE in the schema removes their profile, memberships, splits
// and account settings; houses they created stay for the remaining members.
//
// Before deleting, we optionally record an ANONYMOUS reason for leaving (no user
// id or email) so the churn report can show why people leave.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "Account deletion isn't configured on the server yet (missing service-role key)." },
      { status: 503 },
    );
  }

  // Parse optional, anonymous feedback from the request body.
  let reason: string | null = null;
  let comment: string | null = null;
  try {
    const body = await request.json();
    if (typeof body?.reason === "string" && body.reason) {
      reason = DELETION_REASON_CODES.includes(body.reason) ? body.reason : "other";
    }
    if (typeof body?.comment === "string" && body.comment.trim()) {
      comment = body.comment.trim().slice(0, 1000);
    }
  } catch {
    /* no/invalid body — proceed with the deletion anyway */
  }

  const admin = createAdminClient();

  // Anonymous, non-identifying context for the churn report: how long they were
  // a member, and which platform they left from. No id/email is stored.
  const createdMs = user.created_at ? new Date(user.created_at).getTime() : null;
  const daysActive =
    createdMs != null ? Math.max(0, Math.floor((Date.now() - createdMs) / 86_400_000)) : null;
  const ua = request.headers.get("user-agent") ?? "";
  const platform = /Capacitor|HouseSync|; wv\)/i.test(ua) ? "app" : "web";

  // Record churn feedback first (best-effort — never block the deletion).
  if (reason || comment) {
    const { error: fbErr } = await admin
      .from("deletion_feedback")
      .insert({ reason, comment, days_active: daysActive, platform });
    if (fbErr) console.error("deletion_feedback insert failed:", fbErr.message);
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Clear the now-defunct session cookie.
  try {
    await supabase.auth.signOut();
  } catch {
    /* session already invalid — fine */
  }

  return NextResponse.json({ ok: true });
}
