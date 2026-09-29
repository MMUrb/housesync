import type { SupabaseClient } from "@supabase/supabase-js";
import { sendPushToUsers } from "@/lib/push";
import { formatMoney } from "@/lib/format";
import { getSiteUrl } from "@/lib/env";

// Money-in-limbo nudges, run from the daily reminders cron (one Vercel cron,
// no extra slot needed). Two kinds:
// - a "marked paid" claim whose paid_at falls on the UTC day exactly
//   CLAIM_DAYS ago -> push the person owed to confirm it;
// - an unpaid share whose expense's own nudge day (expenses.nudge_on =
//   date + nudge_after_days, default 7, null = never) is today -> a PRIVATE
//   push to the person who owes. Nobody else ever sees it.
//
// Both triggers are CALENDAR-DAY equality, not hour arithmetic, so the run
// time can drift (cron jitter, BST) without a cohort being double-nudged or
// skipped: each debt's date matches on exactly one calendar day. The one
// remaining way to double-send is running the job twice on the same day, so
// never trigger the cron manually in production.
// One push per person per run: confirm-nudges beat unpaid-nudges, debts
// aggregate per currency, and both kinds respect the existing "payments"
// push toggle (notify_push_paid).
const CLAIM_DAYS = 3;

/** UTC calendar day `offset` days ago, as YYYY-MM-DD. */
function dayUTC(offset: number): string {
  return new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
}

type Bucket = {
  kind: "confirm" | "unpaid";
  total: number;
  others: Set<string>; // the people on the other side of the debts
  currency: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

// PostgREST caps each response (1000 rows by default), so both reads page
// through keyed on id: stable even if rows change between pages, so nobody
// is nudged twice or skipped.
const PAGE = 500;

async function readAllPages(
  build: (after: string | null) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ rows: any[]; error: string | null }> {
  const rows: any[] = [];
  let after: string | null = null;
  for (let i = 0; i < 2000; i++) {
    const { data, error } = await build(after);
    if (error) return { rows, error: error.message };
    const page = (data ?? []) as { id: string }[];
    rows.push(...page);
    if (page.length < PAGE) return { rows, error: null };
    after = page[page.length - 1].id;
  }
  return { rows, error: "pagination limit reached" };
}

export async function runNudges(
  db: SupabaseClient,
): Promise<{ nudged: number; errors: string[] }> {
  const errors: string[] = [];
  const url = `${getSiteUrl()}/housemates`;

  // Claims: status='paid' with paid_at on the target UTC day. Windowed by
  // paid_at itself (NOT the expense date: a claim can land on an old expense).
  const { rows: claimRows, error: claimErr } = await readAllPages((after) => {
    let q = db
      .from("expense_splits")
      .select("id, user_id, amount_owed, paid_at, expenses!inner(paid_by, currency:houses(currency))")
      .eq("status", "paid")
      .gte("paid_at", `${dayUTC(CLAIM_DAYS)}T00:00:00Z`)
      .lt("paid_at", `${dayUTC(CLAIM_DAYS - 1)}T00:00:00Z`)
      .order("id", { ascending: true })
      .limit(PAGE);
    if (after) q = q.gt("id", after);
    return q;
  });
  if (claimErr) errors.push(`nudges claims query: ${claimErr}`);

  // Unpaid: status='unpaid' on expenses whose own nudge day is today.
  // expenses.nudge_on is generated in the database as date + nudge_after_days
  // (default 7, null = never), so this asks for exactly today's rows and each
  // expense still fires on exactly one calendar day.
  const { rows: unpaidRows, error: unpaidErr } = await readAllPages((after) => {
    let q = db
      .from("expense_splits")
      .select("id, user_id, amount_owed, expenses!inner(paid_by, nudge_on, currency:houses(currency))")
      .eq("status", "unpaid")
      .eq("expenses.nudge_on", dayUTC(0))
      .order("id", { ascending: true })
      .limit(PAGE);
    if (after) q = q.gt("id", after);
    return q;
  });
  if (unpaidErr) errors.push(`nudges unpaid query: ${unpaidErr}`);

  // Aggregate per (recipient, currency); confirm beats unpaid per recipient.
  const buckets = new Map<string, Bucket>();
  const hasConfirm = new Set<string>();

  const add = (
    recipient: string,
    kind: Bucket["kind"],
    amount: number,
    other: string,
    currency: string,
  ) => {
    const key = `${recipient}|${currency}`;
    const cur = buckets.get(key);
    if (cur && cur.kind === kind) {
      cur.total += amount;
      cur.others.add(other);
    } else if (!cur) {
      buckets.set(key, { kind, total: amount, others: new Set([other]), currency });
    }
  };

  for (const r of (claimRows ?? []) as any[]) {
    const exp = r.expenses;
    if (!exp?.paid_by || exp.paid_by === r.user_id) continue;
    const amount = Number(r.amount_owed);
    if (!(amount > 0)) continue;
    hasConfirm.add(exp.paid_by as string);
    add(exp.paid_by, "confirm", amount, r.user_id as string, exp.currency?.currency ?? "GBP");
  }
  for (const r of unpaidRows) {
    const exp = r.expenses;
    if (!exp?.paid_by || exp.paid_by === r.user_id) continue;
    if (hasConfirm.has(r.user_id as string)) continue; // confirm wins today
    const amount = Number(r.amount_owed);
    if (!(amount > 0)) continue;
    add(r.user_id, "unpaid", amount, exp.paid_by as string, exp.currency?.currency ?? "GBP");
  }

  // Names for the single-counterpart copy, fetched once each.
  const nameIds = new Set<string>();
  for (const b of buckets.values()) if (b.others.size === 1) nameIds.add([...b.others][0]);
  const names = new Map<string, string>();
  if (nameIds.size > 0) {
    const { data } = await db.from("profiles").select("id, name").in("id", [...nameIds]);
    for (const p of (data ?? []) as any[]) names.set(p.id, (p.name as string) || "a housemate");
  }

  let nudged = 0;
  for (const [key, b] of buckets) {
    const recipient = key.slice(0, key.indexOf("|"));
    const money = formatMoney(b.total, b.currency);
    const one = b.others.size === 1;
    const other = one ? (names.get([...b.others][0]) ?? "a housemate") : "";
    const payload =
      b.kind === "confirm"
        ? {
            title: "Waiting on your confirm",
            body: one
              ? `${other}'s ${money} has waited ${CLAIM_DAYS} days. Confirm it, or mark it not received.`
              : `${b.others.size} housemates' payments worth ${money} have waited ${CLAIM_DAYS} days for your confirm.`,
            url,
            tag: "hs-nudge-confirm",
          }
        : {
            title: "Quiet one, just for you",
            body: one
              ? `Your ${money} to ${other} is still waiting. Two taps and it's gone.`
              : `Shares worth ${money} are still waiting. Two taps each and they're gone.`,
            url,
            tag: "hs-nudge-unpaid",
          };
    try {
      await sendPushToUsers([recipient], payload, "notify_push_paid");
      nudged += 1;
    } catch (e) {
      errors.push(`nudge ${recipient}: ${e instanceof Error ? e.message : "send failed"}`);
    }
  }

  return { nudged, errors };
}
