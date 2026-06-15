import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Admin-only: mark one error (by id) or all errors resolved.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email) || !(await hasAdminSession(user.id))) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Service role isn't configured." }, { status: 503 });
  }

  let id = "";
  let all = false;
  try {
    const b = await request.json();
    if (typeof b?.id === "string") id = b.id;
    all = b?.all === true;
  } catch {
    /* ignore */
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  let q = admin.from("error_logs").update({ resolved_at: now }).is("resolved_at", null);
  if (!all) {
    if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
    q = q.eq("id", id);
  }
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Couldn't update." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
