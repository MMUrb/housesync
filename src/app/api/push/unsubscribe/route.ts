import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Remove the current user's push target (on this device) when they turn
// notifications off or the browser subscription is gone.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { endpoint?: string; token?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }

  let q = supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  if (body.endpoint) q = q.eq("endpoint", body.endpoint);
  else if (body.token) q = q.eq("token", body.token);
  else return NextResponse.json({ error: "Bad request." }, { status: 400 });

  await q;
  return NextResponse.json({ ok: true });
}
