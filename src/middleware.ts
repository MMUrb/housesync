import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp } from "@/lib/csp";
import {
  GATE_COOKIE,
  hasValidGateCookie,
  isGateBypassPath,
  isWaitlistActive,
} from "@/lib/waitlist";

export async function middleware(request: NextRequest) {
  // Per-request CSP nonce. Forward it (and the CSP) on the request headers so
  // Next.js applies the nonce to its own inline scripts during render, then set
  // the CSP on the response so the browser enforces it.
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

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
        requestHeaders.set("x-gate-requested-path", path);
        const res = NextResponse.rewrite(url, { request: { headers: requestHeaders } });
        res.headers.set("content-security-policy", csp);
        return res;
      }
    }
  }

  const response = await updateSession(request, requestHeaders);
  response.headers.set("content-security-policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image files, so the auth
     * session cookie is refreshed on every navigation.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
