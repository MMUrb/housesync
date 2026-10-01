import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { rateLimit } from "@/lib/rateLimit";
import {
  ADMIN_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  isAdminGateEnabled,
  verifyAdminPassword,
  signAdminSession,
} from "@/lib/adminAuth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Must already be the signed-in, allowlisted admin to even attempt the password.
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  if (!isAdminGateEnabled()) {
    return NextResponse.json({ ok: true }); // nothing to unlock
  }

  let password = "";
  try {
    const body = await request.json();
    if (typeof body?.password === "string") password = body.password;
  } catch {
    /* ignore */
  }

  // Five tries per 15 minutes per admin; if the limiter is down, no tries.
  if (!(await rateLimit(`admin-login:${user.id}`, 5, 15 * 60, { failClosed: true }))) {
    return NextResponse.json(
      { error: "Too many attempts. Try again in 15 minutes." },
      { status: 429 },
    );
  }

  if (!password || !verifyAdminPassword(password)) {
    // Small fixed delay to blunt brute-force attempts.
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const token = await signAdminSession(user.id);
  if (!token) {
    return NextResponse.json({ error: "Sign in again, then unlock." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
  return res;
}
