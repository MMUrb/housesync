import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isSmsConfigured, sendSms } from "@/lib/sms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  if (!isAdminConfigured || !isSmsConfigured) {
    return NextResponse.json(
      { error: "SMS isn't set up on the server yet (needs Brevo SMS + service-role key)." },
      { status: 503 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const phone: string = String(body.phone ?? "").trim();
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    return NextResponse.json({ error: "Enter a valid phone number." }, { status: 400 });
  }

  const admin = createAdminClient();

  // Rate-limit: 30s between sends per user.
  const { data: existing } = await admin
    .from("phone_verifications")
    .select("created_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing && Date.now() - new Date(existing.created_at).getTime() < 30_000) {
    return NextResponse.json(
      { error: "Please wait a few seconds before requesting another code." },
      { status: 429 },
    );
  }

  const code = String(randomInt(100000, 1000000)); // 6 digits, CSPRNG
  const expires = new Date(Date.now() + 10 * 60_000).toISOString();

  const { error: upErr } = await admin.from("phone_verifications").upsert(
    {
      user_id: user.id,
      phone,
      code,
      attempts: 0,
      expires_at: expires,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  try {
    await sendSms({ to: phone, content: `Your HouseSync verification code is ${code}` });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not send the text." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
