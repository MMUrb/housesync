import { NextResponse } from "next/server";
import { logError } from "@/lib/errorLog";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Receives unexpected client-side errors from the browser/app (see
// ErrorReporter + reportClientError). Client errors are logged but never email
// the admins (too noisy); only server errors alert.
export async function POST(request: Request) {
  if (!(await rateLimit(`log-error:${clientIp(request)}`, 30, 60))) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }
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
      // The digest column doubles as the app-build stamp for client errors
      // (they never set a digest of their own): "build:<sha>" says which
      // deploy the reporting device was actually running.
      digest:
        typeof b?.digest === "string"
          ? b.digest
          : typeof b?.build === "string" && b.build
            ? `build:${b.build.slice(0, 12)}`
            : null,
    });
  } catch {
    /* ignore malformed reports */
  }
  return NextResponse.json({ ok: true });
}
