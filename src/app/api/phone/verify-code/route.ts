import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Not configured on the server." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "").trim();

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("phone_verifications")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ error: "No code to check. Request a new one." }, { status: 400 });
  }
  if (new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "That code has expired. Request a new one." }, { status: 400 });
  }
  if (row.attempts >= 5) {
    return NextResponse.json(
      { error: "Too many attempts. Request a new code." },
      { status: 429 },
    );
  }
  if (code !== row.code) {
    await admin
      .from("phone_verifications")
      .update({ attempts: row.attempts + 1 })
      .eq("user_id", user.id);
    return NextResponse.json({ error: "Incorrect code. Try again." }, { status: 400 });
  }

  // Success: store the verified number, then clear the code.
  const { error: upErr } = await admin.from("account_settings").upsert(
    {
      user_id: user.id,
      phone: row.phone,
      phone_verified: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  await admin.from("phone_verifications").delete().eq("user_id", user.id);

  return NextResponse.json({ ok: true, phone: row.phone });
}
