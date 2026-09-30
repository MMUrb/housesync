import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { sendPushToUsers } from "@/lib/push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Someone just left a house: tell the house admin, and say so when that
// person's share of bills or expenses still needs adjusting.
//
// The caller is no longer a member, so /api/push/notify (members only) can't
// be used. Instead this accepts only a caller whose OWN departure row (written
// by the database when they left, migration 0046) says they left minutes ago,
// and the only possible recipient is that house's admin. Nothing but the
// house id comes from the client, so nobody can announce a leave that didn't
// happen or message anyone else with it.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  let houseId: string | null = null;
  try {
    const body = await request.json();
    houseId = typeof body?.houseId === "string" ? body.houseId : null;
  } catch {
    /* ignore */
  }
  if (!houseId) return NextResponse.json({ error: "Bad request." }, { status: 400 });
  if (!isAdminConfigured) return NextResponse.json({ ok: true });

  const admin = createAdminClient();
  const [{ data: dep }, { data: still }, { data: house }] = await Promise.all([
    admin
      .from("house_departures")
      .select("kind, name, departed_at")
      .eq("house_id", houseId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("house_members")
      .select("user_id")
      .eq("house_id", houseId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin.from("houses").select("name, created_by").eq("id", houseId).maybeSingle(),
  ]);

  const justLeft =
    dep?.kind === "left" && Date.now() - new Date(dep.departed_at as string).getTime() < 5 * 60_000;
  const adminId = house?.created_by as string | null | undefined;
  if (!justLeft || still || !adminId || adminId === user.id) {
    return NextResponse.json({ ok: true }); // nothing to announce
  }

  // Does the house still count them in? Same test as the admin's reminder card.
  const [portions, pays, owes, owed] = await Promise.all([
    admin
      .from("bill_splits")
      .select("bill_id, recurring_bills!inner(house_id, active)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("recurring_bills.house_id", houseId)
      .eq("recurring_bills.active", true),
    admin
      .from("recurring_bills")
      .select("id", { count: "exact", head: true })
      .eq("house_id", houseId)
      .eq("active", true)
      .eq("paid_by", user.id),
    admin
      .from("expense_splits")
      .select("id, expenses!inner(house_id, paid_by)", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("expenses.house_id", houseId)
      .neq("expenses.paid_by", user.id)
      .neq("status", "confirmed"),
    admin
      .from("expense_splits")
      .select("id, expenses!inner(house_id, paid_by)", { count: "exact", head: true })
      .eq("expenses.house_id", houseId)
      .eq("expenses.paid_by", user.id)
      .neq("user_id", user.id)
      .neq("status", "confirmed"),
  ]);
  const needsAdjusting = [portions, pays, owes, owed].some((r) => (r.count ?? 0) > 0);

  const who = (dep?.name as string | null)?.trim() || "A housemate";
  await sendPushToUsers(
    [adminId],
    {
      title: (house?.name as string | undefined)?.trim() || "Your house",
      body: needsAdjusting
        ? `${who} left the house. Their share of bills and expenses needs adjusting.`
        : `${who} left the house.`,
      url: "/housemates",
      tag: `left-${houseId}`,
    },
    "notify_push_member",
  );
  return NextResponse.json({ ok: true });
}
