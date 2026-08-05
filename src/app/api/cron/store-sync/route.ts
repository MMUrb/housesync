import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { runStoreSync } from "@/lib/storeSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Nightly: pull download numbers from both stores into store_daily. Resyncs
// the last 5 days by default (both stores restate recent days); ?days=N for a
// backfill. Same fail-closed auth as the reminders cron. Admins can also run
// this from the dashboard via /api/admin/store-sync, no secret involved.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Service role isn't configured." }, { status: 503 });
  }

  const url = new URL(request.url);
  const days = Number.parseInt(url.searchParams.get("days") ?? "5", 10);
  const result = await runStoreSync(createAdminClient(), days);
  return NextResponse.json({ ok: true, ...result });
}
