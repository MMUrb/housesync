import { NextResponse } from "next/server";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail, emailLayout } from "@/lib/email";
import { computeBalances, splitEqually } from "@/lib/balances";
import { formatMoney, relativeDay } from "@/lib/format";
import { getSiteUrl } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

function todayPlus(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Daily reminders job (triggered by Vercel Cron — see vercel.json).
 * - Bill reminders when a recurring bill is due in 3 days, 1 day, or today.
 * - A weekly balance nudge (Mondays) to anyone who owes money.
 * Only emails members who have email reminders switched on.
 */
export async function GET(request: Request) {
  // Only allow Vercel Cron (or anyone with the secret) to run this.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  if (!isAdminConfigured || !isEmailConfigured) {
    return NextResponse.json(
      { error: "Reminders not configured. Set SUPABASE_SERVICE_ROLE_KEY and BREVO_API_KEY." },
      { status: 503 },
    );
  }

  const supabase = createAdminClient();
  const siteUrl = getSiteUrl();
  const isMonday = new Date().getUTCDay() === 1;
  let sent = 0;
  const errors: string[] = [];

  // Bills due today, tomorrow, or in 3 days.
  const { data: bills } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("active", true)
    .in("next_due_date", [todayPlus(0), todayPlus(1), todayPlus(3)]);

  // Which houses do we need to process?
  const houseIds = new Set<string>(((bills ?? []) as any[]).map((b) => b.house_id));
  if (isMonday) {
    const { data: allHouses } = await supabase.from("houses").select("id");
    ((allHouses ?? []) as any[]).forEach((h) => houseIds.add(h.id));
  }

  for (const houseId of houseIds) {
    const { data: house } = await supabase
      .from("houses")
      .select("id, name, currency")
      .eq("id", houseId)
      .maybeSingle();
    if (!house) continue;
    const currency = (house as any).currency ?? "GBP";

    const { data: members } = await supabase
      .from("house_members")
      .select("user_id")
      .eq("house_id", houseId);
    const userIds = ((members ?? []) as any[]).map((m) => m.user_id);
    if (userIds.length === 0) continue;

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, email")
      .in("id", userIds);
    const { data: settings } = await supabase
      .from("account_settings")
      .select("user_id, notify_email")
      .in("user_id", userIds);

    const profileById = new Map(((profiles ?? []) as any[]).map((p) => [p.id, p]));
    const optInById = new Map(((settings ?? []) as any[]).map((s) => [s.user_id, s.notify_email]));

    // notify_email defaults to ON when there's no settings row yet.
    const recipient = (uid: string): { email: string; name: string } | null => {
      const p = profileById.get(uid);
      const optedIn = optInById.has(uid) ? optInById.get(uid) : true;
      if (!optedIn || !p?.email) return null;
      return { email: p.email as string, name: (p.name as string) || "there" };
    };

    // --- Bill reminders for this house ---
    const houseBills = ((bills ?? []) as any[]).filter((b) => b.house_id === houseId);
    for (const bill of houseBills) {
      const shares = splitEqually(Number(bill.amount), userIds.length);
      for (let i = 0; i < userIds.length; i++) {
        const uid = userIds[i];
        if (uid === bill.paid_by) continue; // payer doesn't owe themselves
        const r = recipient(uid);
        if (!r) continue;
        const due = relativeDay(bill.next_due_date);
        try {
          await sendEmail({
            to: r.email,
            toName: r.name,
            subject: `${bill.title} is due ${due}, your share is ${formatMoney(shares[i], currency)}`,
            html: emailLayout(
              `<p>Hi ${r.name},</p>
               <p>Your share of <strong>${bill.title}</strong> for <strong>${(house as any).name}</strong> is
               <strong>${formatMoney(shares[i], currency)}</strong>, due <strong>${due}</strong>.</p>
               <p><a href="${siteUrl}/bills" style="color:#5f3fe0;font-weight:bold">Open HouseSync &rarr;</a></p>`,
            ),
          });
          sent++;
        } catch (e) {
          errors.push(`bill ${bill.id} -> ${r.email}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    }

    // --- Weekly balance nudge (Mondays) ---
    if (isMonday) {
      const { data: expenses } = await supabase
        .from("expenses")
        .select("id, paid_by")
        .eq("house_id", houseId);
      const expIds = ((expenses ?? []) as any[]).map((e) => e.id);
      let splits: any[] = [];
      if (expIds.length > 0) {
        const { data: sp } = await supabase
          .from("expense_splits")
          .select("expense_id, user_id, amount_owed, status")
          .in("expense_id", expIds);
        splits = (sp ?? []) as any[];
      }
      const balances = computeBalances(expenses as any, splits as any, userIds[0]);
      for (const uid of userIds) {
        const net = balances.netByUser[uid] ?? 0;
        if (net >= -0.5) continue; // only nudge people who actually owe
        const r = recipient(uid);
        if (!r) continue;
        const owe = Math.round(-net * 100) / 100;
        try {
          await sendEmail({
            to: r.email,
            toName: r.name,
            subject: `You owe ${formatMoney(owe, currency)} in ${(house as any).name}`,
            html: emailLayout(
              `<p>Hi ${r.name},</p>
               <p>A gentle weekly nudge: you currently owe <strong>${formatMoney(owe, currency)}</strong>
               across <strong>${(house as any).name}</strong>.</p>
               <p><a href="${siteUrl}/housemates" style="color:#5f3fe0;font-weight:bold">Settle up on HouseSync &rarr;</a></p>`,
            ),
          });
          sent++;
        } catch (e) {
          errors.push(`digest ${houseId} -> ${r.email}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    }
  }

  return NextResponse.json({ ok: true, sent, errors });
}
