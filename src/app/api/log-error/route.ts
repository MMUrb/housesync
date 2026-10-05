import { NextResponse } from "next/server";
import { logError } from "@/lib/errorLog";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { isOpaqueScriptError } from "@/lib/errorNoise";
import { stampBuild } from "@/lib/buildStamp";

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
    const stack = typeof b?.stack === "string" ? b.stack : null;
    // Also dropped here, not just in the browser, so devices still running
    // an older bundle stop filling the log the moment this deploys.
    if (isOpaqueScriptError(message, stack)) return NextResponse.json({ ok: true });
    await logError({
      source: "client",
      message,
      stack,
      url: typeof b?.url === "string" ? b.url : null,
      userAgent: request.headers.get("user-agent"),
      // The digest column doubles as the app-build stamp for client errors
      // (they never set a digest of their own): the deploy the device ran,
      // and the deploy that received the report, so the Errors tab can tell
      // a stale cached copy from the code that was live at the time.
      digest:
        typeof b?.digest === "string"
          ? b.digest
          : typeof b?.build === "string" && b.build
            ? stampBuild(b.build, process.env.NEXT_PUBLIC_BUILD || "dev")
            : null,
    });
  } catch {
    /* ignore malformed reports */
  }
  return NextResponse.json({ ok: true });
}
