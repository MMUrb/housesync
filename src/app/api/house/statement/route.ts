import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Escapes a value for CSV: wrap in quotes if it contains a comma, quote or
// newline, doubling any internal quotes.
function cell(v: unknown): string {
  const s = v == null ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Downloadable expenses statement (CSV) for one house: one row per expense with
// each housemate's share as its own column, plus a totals row. RLS scopes every
// query to houses the caller belongs to, so passing another house's id returns
// nothing rather than leaking data.
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const houseId = new URL(request.url).searchParams.get("house");
  if (!houseId) return NextResponse.json({ error: "Missing house." }, { status: 400 });

  const { data: house } = await supabase
    .from("houses")
    .select("id, name")
    .eq("id", houseId)
    .maybeSingle();
  if (!house) return NextResponse.json({ error: "House not found." }, { status: 404 });

  const [{ data: members }, { data: cats }, { data: expenses }] = await Promise.all([
    supabase.from("house_members").select("user_id").eq("house_id", houseId),
    supabase.from("house_categories").select("code, name").eq("house_id", houseId),
    supabase
      .from("expenses")
      .select("id, title, category, amount, date, paid_by")
      .eq("house_id", houseId)
      .order("date", { ascending: true }),
  ]);

  const memberIds = (members ?? []).map((m) => m.user_id as string);
  const { data: profiles } = memberIds.length
    ? await supabase.from("profiles").select("id, name").in("id", memberIds)
    : { data: [] as { id: string; name: string | null }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.name || "Housemate"]));
  const catName = new Map((cats ?? []).map((c) => [c.code as string, c.name as string]));
  const prettyCat = (code: string) => catName.get(code) ?? code.charAt(0).toUpperCase() + code.slice(1);

  const expenseIds = (expenses ?? []).map((e) => e.id as string);
  const { data: splits } = expenseIds.length
    ? await supabase
        .from("expense_splits")
        .select("expense_id, user_id, amount_owed")
        .in("expense_id", expenseIds)
    : { data: [] as { expense_id: string; user_id: string; amount_owed: number }[] };

  // expense_id -> (user_id -> share)
  const shareByExpense = new Map<string, Map<string, number>>();
  for (const s of splits ?? []) {
    let m = shareByExpense.get(s.expense_id);
    if (!m) shareByExpense.set(s.expense_id, (m = new Map()));
    m.set(s.user_id, Number(s.amount_owed));
  }

  const memberNames = memberIds.map((id) => nameById.get(id) ?? "Housemate");
  const rows: string[][] = [["Date", "Title", "Category", "Amount", "Paid by", ...memberNames]];

  const totals = { amount: 0, shares: memberIds.map(() => 0) };
  for (const e of expenses ?? []) {
    const shares = shareByExpense.get(e.id as string) ?? new Map<string, number>();
    const amount = Number(e.amount);
    totals.amount += amount;
    rows.push([
      String(e.date),
      String(e.title),
      prettyCat(String(e.category)),
      amount.toFixed(2),
      nameById.get(e.paid_by as string) ?? "",
      ...memberIds.map((id, idx) => {
        const v = shares.get(id);
        if (v != null) totals.shares[idx] += v;
        return v != null ? v.toFixed(2) : "";
      }),
    ]);
  }
  rows.push([
    "Total",
    "",
    "",
    totals.amount.toFixed(2),
    "",
    ...totals.shares.map((v) => v.toFixed(2)),
  ]);

  // Leading BOM so Excel opens the UTF-8 file with the right encoding.
  const csv = "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n");
  const slug = String(house.name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "house";
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="housesync-${slug}-statement-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
