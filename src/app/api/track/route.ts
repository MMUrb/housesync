import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { ADMIN_BASE } from "@/lib/constants";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { uaPlatform, uaBrowser } from "@/lib/ua";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// A per-day, non-reversible visitor fingerprint so we can count unique visitors
// without cookies and without storing any personal data (no raw IPs are kept).
// The salt rotates daily, so the hash can't be used to track people over time.
function hashVisitor(ip: string, ua: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = process.env.ANALYTICS_SALT ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "housesync";
  return createHash("sha256").update(`${day}|${ip}|${ua}|${salt}`).digest("hex").slice(0, 32);
}

// Records a single page view. Best-effort: this must NEVER error the client, so
// every failure path quietly returns 204.
export async function POST(request: Request) {
  try {
    if (!isAdminConfigured) return new NextResponse(null, { status: 204 });

    let path = "/";
    let referrer: string | null = null;
    try {
      const body = JSON.parse((await request.text()) || "{}");
      if (typeof body.path === "string" && body.path) path = body.path.slice(0, 512);
      if (typeof body.referrer === "string" && body.referrer) referrer = body.referrer;
    } catch {
      /* malformed body — ignore */
    }

    // Don't log the admin dashboard or API calls.
    if (path.startsWith(ADMIN_BASE) || path.startsWith("/api")) {
      return new NextResponse(null, { status: 204 });
    }

    const h = request.headers;
    const ip =
      (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
    const ua = h.get("user-agent") ?? "";
    const country = h.get("x-vercel-ip-country");

    // Keep only the referrer's host — never full URLs or query strings.
    let refHost: string | null = null;
    if (referrer) {
      try {
        refHost = new URL(referrer).host || null;
      } catch {
        refHost = null;
      }
    }

    // Throttle per visitor so analytics ingestion can't be flooded.
    if (!(await rateLimit(`track:${clientIp(request)}`, 120, 60))) {
      return new NextResponse(null, { status: 204 });
    }

    const admin = createAdminClient();
    const row = {
      path,
      referrer: refHost,
      visitor_hash: hashVisitor(ip, ua),
      country: country || null,
    };
    // Coarse platform/browser labels (never the raw user agent). If migration
    // 0036 hasn't run yet these columns don't exist, so fall back to the
    // legacy shape rather than silently dropping the page view.
    const { error } = await admin
      .from("page_views")
      .insert({ ...row, platform: uaPlatform(ua), browser: uaBrowser(ua) });
    if (error) await admin.from("page_views").insert(row);
  } catch {
    /* swallow — analytics must never break navigation */
  }
  return new NextResponse(null, { status: 204 });
}
