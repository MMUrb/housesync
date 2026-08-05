import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminEmail } from "@/lib/admin";
import { hasAdminSession } from "@/lib/adminAuth";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { runStoreSync } from "@/lib/storeSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The "Sync now" button on the Acquisition tab. Same job as the nightly cron,
// but authenticated by the admin session instead of the cron secret, so no
// human ever has to handle CRON_SECRET.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAdminEmail(user.email) || !(await hasAdminSession(user.id))) {
    return NextResponse.json({ error: "Not authorised." }, { status: 403 });
  }
  if (!isAdminConfigured) {
    return NextResponse.json({ error: "Service role isn't configured." }, { status: 503 });
  }

  let days = 30; // generous default: covers launch until well into September
  try {
    const b = await request.json();
    if (typeof b?.days === "number") days = b.days;
  } catch {
    /* no body — use the default */
  }

  const result = await runStoreSync(createAdminClient(), days);
  return NextResponse.json({ ok: true, ...result });
}
