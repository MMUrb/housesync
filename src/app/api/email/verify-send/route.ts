import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { isEmailConfigured, sendVerificationEmail } from "@/lib/email";
import { getSiteUrl } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Sends a verification link to the signed-in user's email (our own Brevo email,
// not Supabase's). Clicking it hits /verify-email and sets email_verified_at.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  if (!isEmailConfigured) {
    return NextResponse.json({ error: "Email isn't configured on the server." }, { status: 503 });
  }

  const token = randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  const { error: upErr } = await supabase.from("account_settings").upsert(
    { user_id: user.id, email_verify_token: token, email_verify_expires: expires },
    { onConflict: "user_id" },
  );
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .maybeSingle();

  const url = `${getSiteUrl()}/verify-email?token=${token}`;
  try {
    await sendVerificationEmail(
      user.email,
      (profile as { name: string | null } | null)?.name ?? null,
      url,
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send the email." },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
