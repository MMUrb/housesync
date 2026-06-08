import { NextResponse } from "next/server";
import { ADMIN_COOKIE } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

// Ends the admin-password session (the "Lock" button).
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return res;
}
