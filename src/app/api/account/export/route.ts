import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// GDPR right of access / portability: lets a signed-in user download their own
// data as JSON. Runs with the user's session (RLS-scoped) and filters to rows
// that are about them, so it never leaks a housemate's personal data into one
// person's export. Each table is grabbed defensively — a missing column just
// yields an empty section rather than failing the whole export.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const uid = user.id;
  type Row = Record<string, unknown>;
  const grab = async (
    table: string,
    column: string,
  ): Promise<Row[]> => {
    try {
      const { data } = await supabase.from(table).select("*").eq(column, uid);
      return (data as Row[] | null) ?? [];
    } catch {
      return [];
    }
  };
  const dedupe = (rows: Row[]): Row[] => {
    const seen = new Set<unknown>();
    return rows.filter((r) => {
      const id = (r as { id?: unknown }).id;
      if (id == null) return true;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  };

  const [
    profile,
    memberships,
    expCreated,
    expPaid,
    splits,
    bills,
    choreAssigned,
    choreCreated,
    messages,
    paymentDetails,
    activity,
  ] = await Promise.all([
    grab("profiles", "id"),
    grab("house_members", "user_id"),
    grab("expenses", "created_by"),
    grab("expenses", "paid_by"),
    grab("expense_splits", "user_id"),
    grab("recurring_bills", "created_by"),
    grab("chores", "assigned_to"),
    grab("chores", "created_by"),
    grab("messages", "user_id"),
    grab("payment_details", "user_id"),
    grab("activity", "user_id"),
  ]);

  const payload = {
    exported_at: new Date().toISOString(),
    note: "Your personal HouseSync data. Shared-house records are included only where they relate to you (your expenses, splits, messages and chores).",
    account: { id: uid, email: user.email, created_at: user.created_at },
    profile: profile[0] ?? null,
    payment_details: paymentDetails[0] ?? null,
    houses: memberships,
    expenses: dedupe([...expCreated, ...expPaid]),
    expense_splits: splits,
    bills,
    chores: dedupe([...choreAssigned, ...choreCreated]),
    messages,
    activity,
  };

  const stamp = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="housesync-data-${stamp}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
