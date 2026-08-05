import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { playConfig, ascConfig, fetchPlayDaily, fetchAscDay } from "@/lib/storeSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Launch day: no point asking either store for anything earlier.
const LAUNCH_DAY = "2026-07-25";

const dayString = (msAgo: number) => new Date(Date.now() - msAgo).toISOString().slice(0, 10);

// Nightly: pull download numbers from both stores into store_daily. Runs the
// last 5 days by default (both stores restate recent days), or ?days=400 for a
// full backfill to launch. Same fail-closed auth as the reminders cron.
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
  const daysParam = Number.parseInt(url.searchParams.get("days") ?? "5", 10);
  const days = Math.min(Math.max(Number.isFinite(daysParam) ? daysParam : 5, 1), 400);
  let since = dayString(days * 86_400_000);
  if (since < LAUNCH_DAY) since = LAUNCH_DAY;

  const admin = createAdminClient();
  const result: Record<string, unknown> = { since };

  // Android: monthly CSVs, so one fetch covers the whole window.
  if (!playConfig()) {
    result.android = { configured: false };
  } else {
    try {
      const rows = await fetchPlayDaily(since);
      if (rows.length) {
        const { error } = await admin.from("store_daily").upsert(
          rows.map((r) => ({ ...r, platform: "android", synced_at: new Date().toISOString() })),
          { onConflict: "day,platform" },
        );
        if (error) throw new Error(error.message);
      }
      result.android = { configured: true, upserted: rows.length };
    } catch (e) {
      result.android = { configured: true, error: e instanceof Error ? e.message : String(e) };
    }
  }

  // iOS: one report per day. Yesterday's often isn't published yet; that's
  // fine, the next run picks it up.
  if (!ascConfig()) {
    result.ios = { configured: false };
  } else {
    let upserted = 0;
    let missing = 0;
    try {
      for (let i = 1; i <= days; i++) {
        const day = dayString(i * 86_400_000);
        if (day < LAUNCH_DAY) break;
        const row = await fetchAscDay(day);
        if (!row) {
          missing++;
          continue;
        }
        const { error } = await admin
          .from("store_daily")
          .upsert(
            { ...row, platform: "ios", synced_at: new Date().toISOString() },
            { onConflict: "day,platform" },
          );
        if (error) throw new Error(error.message);
        upserted++;
      }
      result.ios = { configured: true, upserted, notPublishedYet: missing };
    } catch (e) {
      result.ios = {
        configured: true,
        upserted,
        error: e instanceof Error ? e.message : String(e),
      };
    }
  }

  return NextResponse.json({ ok: true, ...result });
}
