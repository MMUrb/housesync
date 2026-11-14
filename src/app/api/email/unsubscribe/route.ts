import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isValidUnsubscribe } from "@/lib/unsubscribe";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Turns "News from HouseSync" off (or back on, for Undo) without signing in.
// The signed token in the link proves which account it belongs to.
//
// POST only changes anything. Gmail and Apple Mail's own Unsubscribe button
// POSTs here (RFC 8058, with u and t in the query string); our /unsubscribe
// page POSTs JSON. A GET just forwards to that page, because mail scanners
// open every link in an email and must never unsubscribe anyone.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const page = new URL("/unsubscribe", url.origin);
  page.search = url.search;
  return NextResponse.redirect(page, 303);
}

export async function POST(request: Request) {
  if (!(await rateLimit(`unsubscribe:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
  const url = new URL(request.url);
  let u = url.searchParams.get("u") ?? "";
  let t = url.searchParams.get("t") ?? "";
  let undo = false;
  // Our page sends JSON; a mail client's one-click sends a form body, which
  // carries nothing we need (u and t are already in the query string).
  const body = (await request.json().catch(() => null)) as { u?: unknown; t?: unknown; undo?: unknown } | null;
  if (body) {
    if (typeof body.u === "string") u = body.u;
    if (typeof body.t === "string") t = body.t;
    undo = body.undo === true;
  }
  if (!isValidUnsubscribe(u, t)) {
    return NextResponse.json({ ok: false, error: "This link isn't valid." }, { status: 400 });
  }
  if (!isAdminConfigured) return NextResponse.json({ ok: false }, { status: 503 });

  const { error } = await createAdminClient()
    .from("account_settings")
    .upsert({ user_id: u, notify_email_news: undo }, { onConflict: "user_id" });
  if (error) return NextResponse.json({ ok: false, error: "Couldn't save that. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true, subscribed: undo });
}
