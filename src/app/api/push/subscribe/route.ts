import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Store the current user's push target: a web subscription or a native FCM
// token. RLS ensures a user can only write their own row.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let body: { kind?: string; subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } }; token?: string; platform?: string } = {};
  try {
    body = await request.json();
  } catch {
    /* ignore */
  }

  if (body.kind === "web" && body.subscription?.endpoint) {
    const s = body.subscription;
    const { error } = await supabase.from("push_subscriptions").upsert(
      {
        user_id: user.id,
        kind: "web",
        endpoint: s.endpoint,
        p256dh: s.keys?.p256dh ?? null,
        auth: s.keys?.auth ?? null,
      },
      { onConflict: "user_id,endpoint" },
    );
    if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.kind === "native" && typeof body.token === "string" && body.token) {
    const platform = body.platform === "ios" || body.platform === "android" ? body.platform : null;
    const { error } = await supabase.from("push_subscriptions").upsert(
      { user_id: user.id, kind: "native", token: body.token, platform },
      { onConflict: "user_id,token" },
    );
    if (error) return NextResponse.json({ error: "Couldn't save." }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Bad request." }, { status: 400 });
}
