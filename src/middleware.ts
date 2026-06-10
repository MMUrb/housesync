import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import {
  GATE_COOKIE,
  hasValidGateCookie,
  isGateBypassPath,
  isWaitlistActive,
} from "@/lib/waitlist";

export async function middleware(request: NextRequest) {
  // Pre-launch waitlist gate. When active, anyone without a valid access
  // cookie is shown /waitlist — except the waitlist page and its endpoints.
  // Flip it off with WAITLIST_ENABLED=false in Vercel when you go public.
  if (isWaitlistActive()) {
    const path = request.nextUrl.pathname;
    if (!isGateBypassPath(path)) {
      const unlocked = await hasValidGateCookie(request.cookies.get(GATE_COOKIE)?.value);
      if (!unlocked) {
        const url = request.nextUrl.clone();
        url.pathname = "/waitlist";
        url.search = "";
        // Tell the waitlist page which path was actually requested so the
        // unlock flow can land the visitor back there (e.g. /hq-k4p9 in the
        // admin app). The browser URL can't be trusted for this — the App
        // Router may swap it for the rewritten /waitlist route on hydration.
        const headers = new Headers(request.headers);
        headers.set("x-gate-requested-path", path);
        return NextResponse.rewrite(url, { request: { headers } });
      }
    }
  }

  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image files, so the auth
     * session cookie is refreshed on every navigation.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
