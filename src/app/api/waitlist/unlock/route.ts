import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, getAccessCode } from "@/lib/waitlist";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Best-effort log of a successful unlock — never blocks the response. */
async function logUnlock(request: Request) {
  if (!isAdminConfigured) return;
  try {
    const h = request.headers;
    const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
    const ua = h.get("user-agent") ?? "";
    const day = new Date().toISOString().slice(0, 10);
    const salt = process.env.ANALYTICS_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "housesync";
    const visitorHash = createHash("sha256").update(`${day}|${ip}|${ua}|${salt}`).digest("hex").slice(0, 32);
    let city = h.get("x-vercel-ip-city");
    if (city) {
      try {
        city = decodeURIComponent(city);
      } catch {
        /* leave as-is */
      }
    }
    await createAdminClient().from("waitlist_unlocks").insert({
      country: h.get("x-vercel-ip-country") || null,
      city: city || null,
      user_agent: ua || null,
      visitor_hash: visitorHash,
    });
  } catch {
    /* swallow — logging must never break the unlock */
  }
}

export async function POST(request: Request) {
  const code = getAccessCode();
  if (!code) {
    // Gate isn't configured — nothing to unlock.
    return NextResponse.json({ ok: true });
  }

  let submitted = "";
  try {
    const body = await request.json();
    if (typeof body?.code === "string") submitted = body.code.trim();
  } catch {
    /* ignore malformed body */
  }

  if (!submitted || submitted !== code) {
    await new Promise((r) => setTimeout(r, 500)); // small delay to blunt brute-force
    return NextResponse.json({ error: "That code isn't right." }, { status: 401 });
  }

  await logUnlock(request);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: GATE_MAX_AGE,
  });
  return res;
}
