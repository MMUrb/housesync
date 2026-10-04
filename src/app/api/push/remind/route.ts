import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getExpensesAndSplits, getSettlements } from "@/lib/data";
import { owedForReminder } from "@/lib/remindAmount";
import { firstName, formatMoney } from "@/lib/format";
import { rateLimit } from "@/lib/rateLimit";
import { sendPushToUsers } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The Remind button on the House tab: a HouseSync notification to
// the housemate who owes you, nothing to share. Everything in it is worked out
// here (the amount comes from the house's own records), it only goes to someone
// who can actually receive it, and each person can be reminded once a day.
//
// Replies { ok: true } or { ok: false, reason } where reason is one of
// nothing_owed | notifications_off | too_soon | error.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONCE_A_DAY = 20 * 60 * 60; // a little under 24h, so a daily habit still works

type Body = { houseId?: string; toUserId?: string };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, reason: "error" }, { status: 401 });

  let body: Body = {};
  try {
    body = await request.json();
  } catch {
    /* empty body */
  }
  const houseId = body.houseId ?? "";
  const toUserId = body.toUserId ?? "";
  if (!UUID.test(houseId) || !UUID.test(toUserId) || toUserId === user.id) {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 400 });
  }

  // RLS: these only come back for a house the caller is in.
  const [{ data: house }, { data: members }] = await Promise.all([
    supabase.from("houses").select("id, name, currency, settle_mode").eq("id", houseId).maybeSingle(),
    supabase.from("house_members").select("user_id").eq("house_id", houseId),
  ]);
  const ids = (members ?? []).map((m) => m.user_id as string);
  if (!house || !ids.includes(user.id) || !ids.includes(toUserId)) {
    return NextResponse.json({ ok: false, reason: "error" }, { status: 403 });
  }

  const mode = house.settle_mode === "simplified" ? "simplified" : "itemised";
  const [{ expenses, splits }, settlements] = await Promise.all([
    getExpensesAndSplits(houseId),
    mode === "simplified" ? getSettlements(houseId) : Promise.resolve([]),
  ]);
  const amount = owedForReminder(mode, user.id, toUserId, expenses, splits, settlements);
  if (amount < 0.005) return NextResponse.json({ ok: false, reason: "nothing_owed" }, { status: 409 });

  // Only send what can arrive: they need a device with notifications on, and
  // the bill-request switch on (a reminder is a request to pay).
  if (!isAdminConfigured) return NextResponse.json({ ok: false, reason: "error" }, { status: 503 });
  const admin = createAdminClient();
  const [{ data: prefs }, { count }] = await Promise.all([
    admin.from("account_settings").select("notify_push_bill").eq("user_id", toUserId).maybeSingle(),
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", toUserId),
  ]);
  if (prefs?.notify_push_bill === false || !count) {
    return NextResponse.json({ ok: false, reason: "notifications_off" }, { status: 409 });
  }

  if (!(await rateLimit(`remind:${houseId}:${user.id}:${toUserId}`, 1, ONCE_A_DAY))) {
    return NextResponse.json({ ok: false, reason: "too_soon" }, { status: 429 });
  }

  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const sender = me?.name?.trim() ? firstName(me.name) : "A housemate";
  await sendPushToUsers(
    [toUserId],
    {
      title: (house.name as string)?.trim() || "HouseSync",
      body: `${sender} sent you a reminder: you owe them ${formatMoney(amount, house.currency as string)}. Tap to settle up.`,
      url: "/housemates",
      tag: `hs-remind-${houseId}-${user.id}`,
    },
    "notify_push_bill",
  );
  return NextResponse.json({ ok: true });
}
