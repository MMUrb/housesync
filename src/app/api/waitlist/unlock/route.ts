import { NextResponse } from "next/server";
import { GATE_COOKIE, GATE_MAX_AGE, gateToken, getAccessCode } from "@/lib/waitlist";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
