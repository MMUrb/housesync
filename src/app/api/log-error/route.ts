import { NextResponse } from "next/server";
import { logError } from "@/lib/errorLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receives unexpected client-side errors from the browser/app (see
// ErrorReporter + reportClientError). Client errors are logged but never email
// the admins (too noisy); only server errors alert.
export async function POST(request: Request) {
  try {
    const b = await request.json();
    const message = typeof b?.message === "string" ? b.message.trim() : "";
    if (!message) return NextResponse.json({ ok: false }, { status: 400 });
    await logError({
      source: "client",
      message,
      stack: typeof b?.stack === "string" ? b.stack : null,
      url: typeof b?.url === "string" ? b.url : null,
      userAgent: request.headers.get("user-agent"),
      digest: typeof b?.digest === "string" ? b.digest : null,
    });
  } catch {
    /* ignore malformed reports */
  }
  return NextResponse.json({ ok: true });
}
