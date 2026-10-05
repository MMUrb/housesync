import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { getExpensesAndSplits, getSettlements } from "@/lib/data";
import { owedForReminder, pendingForConfirm } from "@/lib/remindAmount";
import { firstName, formatMoney } from "@/lib/format";
import { rateLimit } from "@/lib/rateLimit";
import { sendPushToUsers, type PushPrefColumn } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The House tab's reminder buttons: a HouseSync notification to a housemate,
// nothing to share. Two kinds:
// - "owed": they owe you ("you owe them £24.50. Tap to settle up.");
// - "confirm": you've marked a payment to them as paid and they haven't
//   confirmed it yet ("says they paid you £24.50. Tap to confirm you got it.").
// Everything in it is worked out here (amounts come from the house's own
// records), it only goes to someone who can actually receive it, and each kind
// can be sent to each person once a day.
//
// Replies { ok: true } or { ok: false, reason } where reason is one of
// nothing_owed | nothing_pending | notifications_off | too_soon | error.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONCE_A_DAY = 20 * 60 * 60; // a little under 24h, so a daily habit still works

type Body = { houseId?: string; toUserId?: string; kind?: string };

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
  const kind = body.kind === "confirm" ? "confirm" : "owed";
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
  const amount =
    kind === "confirm"
      ? pendingForConfirm(mode, user.id, toUserId, expenses, splits, settlements)
      : owedForReminder(mode, user.id, toUserId, expenses, splits, settlements);
  if (amount < 0.005) {
    return NextResponse.json(
      { ok: false, reason: kind === "confirm" ? "nothing_pending" : "nothing_owed" },
      { status: 409 },
    );
  }

  // Only send what can arrive: they need a device with notifications on, and
  // the matching switch on. A request to pay rides "Bill requests"; a payment
  // waiting on their confirm rides "Payments to you", like the automatic
  // "Waiting on your confirm" nudge.
  const pref: PushPrefColumn = kind === "confirm" ? "notify_push_paid" : "notify_push_bill";
  if (!isAdminConfigured) return NextResponse.json({ ok: false, reason: "error" }, { status: 503 });
  const admin = createAdminClient();
  const [{ data: prefs }, { count }] = await Promise.all([
    admin.from("account_settings").select(pref).eq("user_id", toUserId).maybeSingle(),
    admin.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", toUserId),
  ]);
  if ((prefs as Record<string, unknown> | null)?.[pref] === false || !count) {
    return NextResponse.json({ ok: false, reason: "notifications_off" }, { status: 409 });
  }

  const key = `remind${kind === "confirm" ? "-confirm" : ""}:${houseId}:${user.id}:${toUserId}`;
  if (!(await rateLimit(key, 1, ONCE_A_DAY))) {
    return NextResponse.json({ ok: false, reason: "too_soon" }, { status: 429 });
  }

  const { data: me } = await supabase.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const sender = me?.name?.trim() ? firstName(me.name) : "A housemate";
  const money = formatMoney(amount, house.currency as string);
  await sendPushToUsers(
    [toUserId],
    {
      title: (house.name as string)?.trim() || "HouseSync",
      body:
        kind === "confirm"
          ? `${sender} says they paid you ${money}. Tap to confirm you got it.`
          : `${sender} sent you a reminder: you owe them ${money}. Tap to settle up.`,
      url: "/housemates",
      tag: `hs-${kind === "confirm" ? "confirm" : "remind"}-${houseId}-${user.id}`,
    },
    pref,
  );
  return NextResponse.json({ ok: true });
}
