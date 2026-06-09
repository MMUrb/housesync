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
        return NextResponse.rewrite(url);
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
