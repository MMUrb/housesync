import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient, isAdminConfigured } from "@/lib/supabase/admin";
import { isEmailConfigured, sendEmail, emailLayout, escapeHtml } from "@/lib/email";
import { computeBalances, splitEqually } from "@/lib/balances";
import { formatDate, formatMoney, relativeDay } from "@/lib/format";
import { getSiteUrl } from "@/lib/env";
import { runNudges } from "@/lib/nudges";
import { sendPushToUsers, type PushPayload } from "@/lib/push";
import { logError } from "@/lib/errorLog";
import { addDaysISO, daysBetweenISO, todayISO } from "@/lib/recurrence";
import { portionAmounts, portionsValid, type PortionRow } from "@/lib/billPortions";
import { autoPortionsFor } from "@/lib/features";
import {
  LATE_CREATE_DAYS,
  OVERDUE_SHOT_DAYS,
  billActionableToday,
  billSchedule,
  chaseTargets,
  nudgeAfterDaysFor,
  planPortionedCycles,
} from "@/lib/billEngine";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */

// PostgREST caps every response (1000 rows by default): anything that could
// grow past that is read in keyset pages (stable even if rows change midway),
// and id lists go in short chunks (URL length).
const PAGE = 500;
const CHUNK = 100;
// Vercel kills the function at 60s. Nothing new starts after START_BY, and
// every wait is capped to end by HARD_STOP, leaving room to log and reply,
// so a run always finishes and reports what it didn't get to.
const START_BY_MS = 35_000;
const HARD_STOP_MS = 50_000;
const SEND_CONCURRENCY = 6;
// Each send is capped just above push.ts's own 12s ceiling (and by HARD_STOP).
const SEND_TIMEOUT_MS = 13_000;

type EngineCycle = {
  id: string;
  date: string;
  paid_by: string | null;
  auto_cycle: boolean;
  cycle_due: string | null;
};
type EngineBill = {
  id: string;
  house_id: string;
  title: string;
  amount: number;
  frequency: string;
  due_day: number | null;
  next_due_date: string;
  paid_by: string | null;
  created_by: string | null;
  reminder_enabled: boolean;
  reminder_days: number[] | null;
  bill_splits: PortionRow[] | null;
  expenses: EngineCycle[] | null;
};
type Job = { priority: number; label: string; run: () => Promise<void> };

const shortDay = (iso: string) => formatDate(iso, { day: "numeric", month: "short" });

/** Stable per-day shuffle key: no house is always last in line. */
function dayOrder(id: string, today: string): number {
  let h = 0x811c9dc5;
  const s = `${id}:${today}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${what} timed out`)), ms)),
  ]);
}

function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Reads every row a query matches, 500 at a time, keyed on id. */
async function readKeyset<T extends { id: string }>(
  build: (after: string | null) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const rows: T[] = [];
  let after: string | null = null;
  for (let i = 0; i < 2000; i++) {
    const { data, error } = await build(after);
    if (error) return { rows, error: error.message };
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < PAGE) return { rows, error: null };
    after = page[page.length - 1].id;
  }
  return { rows, error: "pagination limit reached" };
}

/**
 * Every active bill with a due date, with its portions and its engine cycles
 * (by pinned cycle_due) embedded in the same rows, so a bill can never be
 * judged on half its data.
 */
async function loadEngineBills(
  db: SupabaseClient,
  today: string,
): Promise<{ bills: EngineBill[]; error: string | null }> {
  const { rows, error } = await readKeyset<EngineBill>((after) => {
    let q = db
      .from("recurring_bills")
      .select(
        "id, house_id, title, amount, frequency, due_day, next_due_date, paid_by, created_by, reminder_enabled, reminder_days, bill_splits(user_id, share_type, value), expenses(id, date, paid_by, auto_cycle, cycle_due)",
      )
      .eq("active", true)
      .not("next_due_date", "is", null)
      .eq("expenses.auto_cycle", true)
      .gte("expenses.cycle_due", addDaysISO(today, -(LATE_CREATE_DAYS + 1)))
      .order("id", { ascending: true })
      .limit(PAGE);
    if (after) q = q.gt("id", after);
    return q;
  });
  // A bill seen twice would be processed (and its reminders sent) twice.
  const byId = new Map(rows.map((b) => [b.id, b]));
  return { bills: [...byId.values()], error };
}

/**
 * Daily reminders job (triggered by Vercel Cron, see vercel.json). Never run it
 * twice in one day: the day-keyed pushes would repeat (cycle creation itself
 * is protected in the database). Order of work, most important first:
 * 1. money: portioned cycles created, schedules caught up (fast RPCs);
 * 2. notifications from step 1 and today's reminders, by priority;
 * 3. money-in-limbo nudges; 4. Monday's balance emails.
 */
export async function GET(request: Request) {
  // Only Vercel Cron (or someone with the secret) may run this. Fail CLOSED: if
  // no secret is configured, refuse rather than run open to the whole internet.
  // Vercel automatically sends "Authorization: Bearer <CRON_SECRET>" when the
  // CRON_SECRET env var is set, so set it in the project for the cron to work.
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Reminders are not configured (set CRON_SECRET)." },
      { status: 503 },
    );
  }
  const authGiven = Buffer.from(request.headers.get("authorization") ?? "");
  const authWanted = Buffer.from(`Bearer ${secret}`);
  if (authGiven.length !== authWanted.length || !timingSafeEqual(authGiven, authWanted)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The money engine only needs the database. Emails are skipped (not the
  // whole run) when no email provider is configured.
  if (!isAdminConfigured) {
    return NextResponse.json(
      { error: "Reminders not configured. Set SUPABASE_SERVICE_ROLE_KEY." },
      { status: 503 },
    );
  }

  const startedAt = Date.now();
  const timeLeft = () => START_BY_MS - (Date.now() - startedAt);
  const hardLeft = () => HARD_STOP_MS - (Date.now() - startedAt);
  const supabase = createAdminClient();
  const siteUrl = getSiteUrl();
  const url = `${siteUrl}/bills`;
  const today = todayISO();
  const isMonday = new Date().getUTCDay() === 1;

  let sent = 0;
  let pushed = 0;
  let cyclesCreated = 0;
  let engineFailures = 0;
  let deferredHouses = 0;
  let deferredSends = 0;
  const errors: string[] = [];
  const jobs: Job[] = [];

  const pushJob = (to: string, payload: PushPayload, label: string, priority: number) =>
    jobs.push({
      priority,
      label,
      run: async () => {
        await sendPushToUsers([to], payload, "notify_push_bill");
        pushed++;
      },
    });
  const emailJob = (args: Parameters<typeof sendEmail>[0], label: string, priority: number) =>
    isEmailConfigured &&
    jobs.push({
      priority,
      label,
      run: async () => {
        await sendEmail(args);
        sent++;
      },
    });
  const activity = async (houseId: string, userId: string, type: string, message: string) => {
    const { error } = await supabase.from("activity").insert({ house_id: houseId, user_id: userId, type, message });
    if (error) errors.push(`activity ${houseId}: ${error.message}`);
  };

  // ---- 1. Which bills have anything to do today? (no house data needed) ----
  const { bills: engineBills, error: billsErr } = await loadEngineBills(supabase, today);
  if (billsErr) {
    // Never fall back to guessing: a bill judged without its portions would
    // drop onto the manual path and tell its payer to request by hand.
    engineFailures++;
    errors.push(`bill engine skipped today: ${billsErr}`);
  }
  const actionable = billsErr
    ? []
    : engineBills.filter((b) =>
        billActionableToday({
          nextDue: b.next_due_date,
          today,
          schedule: billSchedule(b.reminder_enabled, b.reminder_days),
          portions: b.bill_splits ?? [],
          amount: Number(b.amount),
          autoCycleDates: (b.expenses ?? [])
            .filter((c) => c.auto_cycle && c.cycle_due)
            .map((c) => c.cycle_due as string),
        }),
      );
  const billsByHouse = new Map<string, EngineBill[]>();
  for (const b of actionable) {
    const arr = billsByHouse.get(b.house_id) ?? [];
    arr.push(b);
    billsByHouse.set(b.house_id, arr);
  }
  const billHouses = [...billsByHouse.keys()].sort((a, b) => dayOrder(a, today) - dayOrder(b, today));

  let digestHouses: string[] = [];
  if (isMonday) {
    const { rows, error } = await readKeyset<{ id: string }>((after) => {
      let q = supabase.from("houses").select("id").order("id", { ascending: true }).limit(PAGE);
      if (after) q = q.gt("id", after);
      return q;
    });
    if (error) errors.push(`digest: houses read failed: ${error}`);
    digestHouses = rows.map((h) => h.id).sort((a, b) => dayOrder(a, today) - dayOrder(b, today));
  }

  // ---- 2. House data for every house we'll touch, in a few batched reads ----
  const allHouses = [...new Set([...billHouses, ...digestHouses])];
  const houseInfo = new Map<string, { name: string; currency: string }>();
  const membersOf = new Map<string, string[]>();
  const failedHouses = new Set<string>();
  for (const part of chunks(allHouses, CHUNK)) {
    const { data, error } = await supabase.from("houses").select("id, name, currency").in("id", part);
    if (error) {
      part.forEach((h) => {
        failedHouses.add(h);
        // A bill house skipped today is money not billed: an engine failure.
        if (billsByHouse.has(h)) engineFailures++;
      });
      errors.push(`houses read failed: ${error.message}`);
      continue;
    }
    for (const h of (data ?? []) as any[]) houseInfo.set(h.id, { name: h.name, currency: h.currency ?? "GBP" });
  }
  for (const part of chunks(allHouses, 50)) {
    // Membership decides whose portions are valid: never guess without it.
    const { rows, error } = await readKeyset<{ id: string; house_id: string; user_id: string }>((after) => {
      let q = supabase
        .from("house_members")
        .select("id, house_id, user_id")
        .in("house_id", part)
        .order("id", { ascending: true })
        .limit(PAGE);
      if (after) q = q.gt("id", after);
      return q;
    });
    if (error) {
      part.forEach((h) => {
        if (!failedHouses.has(h) && billsByHouse.has(h)) engineFailures++;
        failedHouses.add(h);
      });
      errors.push(`members read failed: ${error}`);
      continue;
    }
    for (const m of rows) {
      const arr = membersOf.get(m.house_id) ?? [];
      arr.push(m.user_id);
      membersOf.set(m.house_id, arr);
    }
  }
  const everyone = [...new Set([...membersOf.values()].flat())];
  const profileById = new Map<string, { name: string | null; email: string | null }>();
  const settingsById = new Map<string, any>();
  let settingsFailed = false;
  for (const part of chunks(everyone, CHUNK)) {
    const { data: profs, error: profErr } = await supabase.from("profiles").select("id, name, email").in("id", part);
    // Names only shape wording: degrade, don't skip.
    if (profErr) errors.push(`profiles read failed: ${profErr.message}`);
    for (const p of (profs ?? []) as any[]) profileById.set(p.id, { name: p.name, email: p.email });
    const { data: sets, error: setErr } = await supabase
      .from("account_settings")
      .select("user_id, notify_email, notify_email_bills, notify_email_nudges")
      .in("user_id", part);
    if (setErr) {
      settingsFailed = true;
      errors.push(`settings read failed: ${setErr.message}`);
    }
    for (const s of (sets ?? []) as any[]) settingsById.set(s.user_id, s);
  }
  const firstNameOf = (id: string | null) =>
    ((id && profileById.get(id)?.name) || "").trim().split(/\s+/)[0] || "a housemate";
  // Every flag defaults to ON when there's no settings row yet. A user is
  // emailed only if the master (notify_email) AND the category are both on.
  // A failed settings read sends no emails rather than ignoring opt-outs.
  const recipient = (
    uid: string,
    category: "notify_email_bills" | "notify_email_nudges",
  ): { email: string; name: string } | null => {
    if (settingsFailed) return null;
    const p = profileById.get(uid);
    const s = settingsById.get(uid);
    const masterOn = s ? s.notify_email !== false : true;
    const categoryOn = s ? s[category] !== false : true;
    if (!masterOn || !categoryOn || !p?.email) return null;
    return { email: p.email, name: p.name || "there" };
  };

  // ---- 3. Money first: every bill's writes, notifications queued ----
  type Chase = {
    billId: string;
    billTitle: string;
    cycleId: string;
    cycleDue: string;
    payer: string;
    currency: string;
    members: string[];
  };
  const chases: Chase[] = [];

  for (const houseId of billHouses) {
    if (timeLeft() <= 0) {
      deferredHouses++;
      continue;
    }
    if (failedHouses.has(houseId)) continue;
    const house = houseInfo.get(houseId);
    const userIds = membersOf.get(houseId) ?? [];
    if (!house || userIds.length === 0) continue;
    const { name: houseName, currency } = house;

    for (const bill of billsByHouse.get(houseId) ?? []) {
      try {
        const nd = bill.next_due_date;
        const amount = Number(bill.amount);
        const amountStr = formatMoney(amount, currency);
        const sched = billSchedule(bill.reminder_enabled, bill.reminder_days);
        const daysToDue = daysBetweenISO(today, nd);
        // paid_by is the payer; null (their account was deleted) = no payer.
        const payerId = bill.paid_by;
        const billTag = `hs-bill-${bill.id}`;
        const solo = userIds.length === 1;

        // A payer who has left can't be paid back: the house has to pick a
        // new one on the bill (which also clears the old portions).
        if (!payerId || !userIds.includes(payerId)) continue;

        const portions = bill.bill_splits ?? [];
        // Solo houses have nobody to portion to, so they stay on the manual
        // flow (and its solo reminders) whatever rows are left over.
        const portioned = portions.length > 0 && !solo;
        // FEATURES.autoPortions can stop automatic billing (everywhere or
        // outside a trial list): those bills take the manual path below.
        const autoOn = autoPortionsFor(houseId);

        if (portioned && autoOn) {
          const autoCycles = (bill.expenses ?? [])
            .filter((c) => c.auto_cycle && c.cycle_due)
            .map((c) => ({ ...c, date: c.cycle_due as string }));

          // 3a. Chase unpaid shares on the later reminder days, from the
          //     morning's snapshot (reads batched after this loop).
          for (const cycle of chaseTargets(autoCycles, sched.laterLeads, today)) {
            chases.push({
              billId: bill.id,
              billTitle: bill.title,
              cycleId: cycle.id,
              cycleDue: cycle.date,
              payer: cycle.paid_by ?? payerId,
              currency,
              members: userIds,
            });
          }

          // 3b. Broken set (someone left, the amount changed): sends pause,
          //     and the payer hears about it on the days they'd expect
          //     action. With reminders off, once, on the due date.
          if (!portionsValid(portions, amount, userIds)) {
            const warnToday = sched.remindersOn
              ? sched.leads.includes(daysToDue) || daysToDue === -OVERDUE_SHOT_DAYS
              : daysToDue === 0;
            if (warnToday) {
              pushJob(
                payerId,
                {
                  title: `${bill.title} portions need updating`,
                  body: `They no longer cover ${amountStr} between the people in the house, so the automatic sends are paused. Fix them and it carries on.`,
                  url,
                  tag: billTag,
                },
                `portions push ${bill.id}`,
                1,
              );
            }
            continue;
          }

          // 3c. Create every cycle whose day has come. The database locks
          //     the bill and compare-and-swaps the due date, the payer and
          //     the portions, so a stale snapshot can't bill old numbers.
          const plan = planPortionedCycles(nd, bill.frequency, bill.due_day ?? undefined, today, sched.createLead);
          const rows = portionAmounts(portions, amount, payerId)
            .filter((r) => r.user_id === payerId || r.amount > 0)
            .map((r) => ({ user_id: r.user_id, amount_owed: r.amount }));
          const expectedPortions = portions.map((p) => ({
            user_id: p.user_id,
            share_type: p.share_type,
            value: Number(p.value),
          }));
          let expected = nd;
          let moved = false; // next_due_date left nd: any skipped dates are now final
          for (const c of plan.creates) {
            let res: unknown;
            try {
              const { data, error: rpcErr } = await withTimeout(
                Promise.resolve(
                  supabase.rpc("create_bill_cycle", {
                    p_bill_id: bill.id,
                    p_expected_due: expected,
                    p_expected_payer: payerId,
                    p_expected_portions: expectedPortions,
                    p_expense_date: c.due,
                    p_next_due: c.next,
                    p_rows: rows,
                    p_auto: true,
                    p_split_type: "custom",
                    p_nudge_after_days: nudgeAfterDaysFor(c.daysToDue),
                    p_notes: "Portions sent from recurring bill",
                    p_actor: payerId,
                  }),
                ),
                Math.max(1_000, Math.min(15_000, hardLeft())),
                "create_bill_cycle",
              );
              if (rpcErr) throw new Error(rpcErr.message);
              res = data;
            } catch (e) {
              // Timed out or failed: if it did commit, tomorrow's run sees
              // the cycle ('exists' / 'stale') and nothing is billed twice.
              engineFailures++;
              errors.push(`cycle ${bill.id} ${c.due}: ${e instanceof Error ? e.message : "failed"}`);
              break;
            }
            const status = (res as any)?.status as string | undefined;
            if (status !== "created" && status !== "exists" && status !== "too_soon") {
              // stale/missing: the bill moved since the snapshot. Tomorrow's
              // run judges it afresh.
              break;
            }
            moved = true;
            expected = c.next;

            if (status === "too_soon") {
              // The due date was moved into a period that already went out.
              // Mostly billed already: skipped whole. Otherwise it starts
              // when that period runs out, which the plan knows nothing
              // about, so tomorrow's run takes it from there.
              const clash = String((res as any)?.clash ?? "");
              const movedTo = String((res as any)?.next_due_date ?? c.next);
              // Its own tag: the skipped-dates push below can fire in the
              // same run and must not replace this one.
              const clashTag = `${billTag}-clash`;
              if (movedTo !== c.next) {
                await activity(
                  houseId,
                  payerId,
                  "bill_skipped",
                  `had “${bill.title}” due ${shortDay(c.due)} moved to ${shortDay(movedTo)}, when the ${shortDay(clash)} one runs out`,
                );
                pushJob(
                  payerId,
                  {
                    title: `${bill.title} due ${shortDay(c.due)} moved to ${shortDay(movedTo)}`,
                    body: `The ${shortDay(clash)} one runs until ${shortDay(movedTo)}, so this one starts then and nothing is billed twice.`,
                    url,
                    tag: clashTag,
                  },
                  `too-soon push ${bill.id}`,
                  1,
                );
                break;
              }
              await activity(
                houseId,
                payerId,
                "bill_skipped",
                `had “${bill.title}” due ${shortDay(c.due)} skipped: the ${shortDay(clash)} one already covers that period`,
              );
              pushJob(
                payerId,
                {
                  title: `${bill.title} due ${shortDay(c.due)} wasn't sent`,
                  body: `The ${shortDay(clash)} one already covers that period, so it isn't billed twice. Next up: ${shortDay(c.next)}.`,
                  url,
                  tag: clashTag,
                },
                `too-soon push ${bill.id}`,
                1,
              );
              continue;
            }
            if (status !== "created") continue;
            cyclesCreated++;
            await activity(houseId, payerId, "bill_logged", `had “${bill.title}” sent out automatically (${amountStr})`);

            if (!sched.remindersOn) continue; // reminders off: billed silently
            const cycleTag = `hs-bill-${bill.id}-${c.due}`;
            const rel = relativeDay(c.due);
            const dueWords = c.daysToDue < 0 ? `was due ${rel}` : `is due ${rel}`;
            for (const r of rows) {
              if (r.user_id === payerId || !(r.amount_owed > 0)) continue;
              pushJob(
                r.user_id,
                {
                  title: `Your ${bill.title} is ${formatMoney(r.amount_owed, currency)}`,
                  body: `${houseName}'s ${bill.title} ${dueWords}. Pay ${firstNameOf(payerId)} when you're ready.`,
                  url,
                  tag: cycleTag,
                },
                `portion push ${bill.id}`,
                0,
              );
            }
            pushJob(
              payerId,
              {
                title: `${bill.title}: portions sent`,
                body: `Everyone's been told their share (${dueWords}). Nothing for you to do.`,
                url,
                tag: cycleTag,
              },
              `portion push ${bill.id}`,
              0,
            );
          }

          // 3d. Occurrences too old to send were stepped over. With nothing
          //     created, persist the catch-up with the same compare-and-swap.
          if (plan.skippedCount > 0 && plan.skippedFirst) {
            if (plan.creates.length === 0) {
              const { data: rolled, error: rollErr } = await supabase
                .from("recurring_bills")
                .update({ next_due_date: plan.finalNext })
                .eq("id", bill.id)
                .eq("next_due_date", nd)
                .select("id");
              if (rollErr) {
                engineFailures++;
                errors.push(`catch-up ${bill.id}: ${rollErr.message}`);
              } else if (rolled && rolled.length > 0) {
                moved = true;
              }
            }
            // Money that will never be billed: always said, reminders or not,
            // and kept on the house feed in case the push never lands.
            if (moved) {
              const more = plan.skippedCount - 1;
              const which = more > 0
                ? `due ${shortDay(plan.skippedFirst)} (and ${more} more after it)`
                : `due ${shortDay(plan.skippedFirst)}`;
              await activity(
                houseId,
                payerId,
                "bill_skipped",
                `had “${bill.title}” ${which} skipped: more than a week overdue. Add ${more > 0 ? "them" : "it"} as expenses if still owed`,
              );
              pushJob(
                payerId,
                {
                  title: `${bill.title} ${which} wasn't sent`,
                  body: `${more > 0 ? "They were" : "It was"} more than a week overdue, so ${more > 0 ? "they're" : "it's"} skipped rather than billed late. Add ${more > 0 ? "them" : "it"} as an expense if still owed.`,
                  url,
                  tag: billTag,
                },
                `catch-up push ${bill.id}`,
                1,
              );
            }
          }
          continue;
        }

        // ---- MANUAL (no portions, or automatic billing off): reminders ----
        if (!sched.remindersOn) continue;
        const onSchedule = sched.leads.includes(daysToDue);
        const isOverdueShot = daysToDue === -OVERDUE_SHOT_DAYS;
        if (!onSchedule && !isOverdueShot) continue;
        const due = relativeDay(nd);

        // Owers' heads-up ahead of the due date: their share of an equal
        // split. Not for portioned bills: equal shares would be the wrong
        // numbers, and the payer's request tells everyone their real portion.
        if (onSchedule && !solo && !portioned) {
          const shares = splitEqually(amount, userIds.length);
          userIds.forEach((uid, i) => {
            if (uid === payerId) return; // the payer gets their own push below
            const r = recipient(uid, "notify_email_bills");
            if (!r) return;
            emailJob(
              {
                to: r.email,
                toName: r.name,
                subject: `${bill.title} is due ${due}, your share is ${formatMoney(shares[i], currency)}`,
                html: emailLayout(
                  `<p>Hi ${escapeHtml(r.name)},</p>
                   <p>Your share of <strong>${escapeHtml(bill.title)}</strong> for <strong>${escapeHtml(houseName)}</strong> is
                   <strong>${formatMoney(shares[i], currency)}</strong>, due <strong>${due}</strong>.</p>
                   <p><a href="${siteUrl}/bills" style="color:#5f3fe0;font-weight:bold">Open HouseSync &rarr;</a></p>`,
                ),
              },
              // Per recipient: a bill with several owers fails per person,
              // and the log must say who missed out, not just which bill.
              `bill email ${bill.id} -> ${uid}`,
              2,
            );
          });
        }

        // Payer-side push: they pay the provider and request the shares, and
        // they used to hear nothing at all (a solo house got no reminder from
        // anyone). The overdue shot fires exactly once, 2 days past, only
        // while the cycle is still unrequested; requesting rolls
        // next_due_date forward so it can never match. A portioned bill
        // whose portions don't add up can't be requested until they're fixed
        // (automatic billing switched off), so say that instead.
        const fixFirst = portioned && !portionsValid(portions, amount, userIds);
        pushJob(
          payerId,
          fixFirst
            ? {
                title: `${bill.title} ${isOverdueShot ? "was" : "is"} due ${due}`,
                body: "Its portions need updating before it can be requested. Fix them on the Bills page.",
                url,
                tag: billTag,
              }
            : isOverdueShot
              ? {
                  title: `${bill.title} was due ${due}`,
                  body: solo
                    ? "Still not logged. If it's handled, log it on HouseSync and you're square."
                    : "Still not requested. If it's handled, request everyone's share so the records stay straight.",
                  url,
                  tag: billTag,
                }
              : {
                  title: `${bill.title} is due ${due}`,
                  body: solo
                    ? `${amountStr} for ${houseName}. Log it once it's paid.`
                    : `${amountStr} for ${houseName}. Request everyone's share in a tap.`,
                  url,
                  tag: billTag,
                },
          `bill push ${bill.id}`,
          2,
        );
      } catch (e) {
        engineFailures++;
        errors.push(`bill ${bill.id}: ${e instanceof Error ? e.message : "failed"}`);
      }
    }
  }

  // Chase reads, batched: what's still unpaid on each chased cycle.
  if (chases.length > 0) {
    const byCycle = new Map(chases.map((c) => [c.cycleId, c]));
    for (const part of chunks([...byCycle.keys()], CHUNK)) {
      const { rows, error } = await readKeyset<{ id: string; expense_id: string; user_id: string; amount_owed: number }>(
        (after) => {
          let q = supabase
            .from("expense_splits")
            .select("id, expense_id, user_id, amount_owed")
            .in("expense_id", part)
            .eq("status", "unpaid")
            .order("id", { ascending: true })
            .limit(PAGE);
          if (after) q = q.gt("id", after);
          return q;
        },
      );
      if (error) {
        errors.push(`chase read failed: ${error}`);
        continue;
      }
      // Part payments leave several rows per person: one push each.
      const owed = new Map<string, Map<string, number>>();
      for (const s of rows) {
        const m = owed.get(s.expense_id) ?? new Map<string, number>();
        m.set(s.user_id, (m.get(s.user_id) ?? 0) + Number(s.amount_owed));
        owed.set(s.expense_id, m);
      }
      for (const [cycleId, perUser] of owed) {
        const c = byCycle.get(cycleId);
        if (!c) continue;
        for (const [uid, amt] of perUser) {
          if (uid === c.payer || !(amt > 0.004) || !c.members.includes(uid)) continue;
          pushJob(
            uid,
            {
              title: `${c.billTitle} is due ${relativeDay(c.cycleDue)}`,
              body: `Your ${formatMoney(amt, c.currency)} to ${firstNameOf(c.payer)} is still unpaid.`,
              url,
              tag: `hs-bill-${c.billId}-${c.cycleDue}`,
            },
            `chase push ${c.billId}`,
            1,
          );
        }
      }
    }
  }

  // ---- 4. Notifications, most important first, a few at a time ----
  jobs.sort((a, b) => a.priority - b.priority);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      // Nothing new after START_BY, and no send may run past HARD_STOP.
      const cap = Math.min(SEND_TIMEOUT_MS, hardLeft());
      if (timeLeft() <= 0 || cap < 1_000) return;
      const job = jobs[next++];
      try {
        await withTimeout(job.run(), cap, job.label);
      } catch (e) {
        errors.push(`${job.label}: ${e instanceof Error ? e.message : "send failed"}`);
      }
    }
  };
  await Promise.all(Array.from({ length: SEND_CONCURRENCY }, worker));
  deferredSends = jobs.length - Math.min(next, jobs.length);

  // ---- 5. Money-in-limbo nudges, with whatever time is left ----
  let nudges: { nudged: number; errors: string[] } = { nudged: 0, errors: [] };
  if (timeLeft() > 3_000) {
    try {
      nudges = await withTimeout(runNudges(supabase), Math.max(1_000, hardLeft() - 1_000), "nudges");
    } catch (e) {
      nudges.errors.push(`nudges: ${e instanceof Error ? e.message : "failed"}`);
    }
  } else {
    nudges.errors.push("nudges: skipped, time budget used up");
  }

  // ---- 6. Weekly balance nudge (Mondays) ----
  let deferredDigestEmails = 0;
  for (const houseId of isEmailConfigured ? digestHouses : []) {
    if (timeLeft() <= 0) {
      deferredDigestEmails++;
      continue;
    }
    if (failedHouses.has(houseId)) continue;
    const house = houseInfo.get(houseId);
    const userIds = membersOf.get(houseId) ?? [];
    if (!house || userIds.length === 0) continue;
    try {
      const { rows: expenses, error: expErr } = await readKeyset<{ id: string; paid_by: string | null }>((after) => {
        let q = supabase
          .from("expenses")
          .select("id, paid_by")
          .eq("house_id", houseId)
          .order("id", { ascending: true })
          .limit(PAGE);
        if (after) q = q.gt("id", after);
        return q;
      });
      if (expErr) throw new Error(`digest expenses read: ${expErr}`);
      const splits: any[] = [];
      for (const part of chunks(expenses.map((e) => e.id), CHUNK)) {
        const { rows, error } = await readKeyset<{ id: string }>((after) => {
          let q = supabase
            .from("expense_splits")
            .select("id, expense_id, user_id, amount_owed, status")
            .in("expense_id", part)
            .order("id", { ascending: true })
            .limit(PAGE);
          if (after) q = q.gt("id", after);
          return q;
        });
        if (error) throw new Error(`digest splits read: ${error}`);
        splits.push(...rows);
      }
      // Settlements (simplified settle mode) shift net positions; without them
      // the nudge would chase money that's already been paid via a reroute.
      // If that read fails we skip this house's nudges rather than email
      // balances we know are missing a piece.
      const { data: setts, error: settErr } = await supabase
        .from("settlements")
        .select("*")
        .eq("house_id", houseId);
      if (settErr) throw new Error(`digest settlements read: ${settErr.message}`);
      const balances = computeBalances(expenses as any, splits as any, userIds[0], (setts ?? []) as any);
      for (const uid of userIds) {
        const net = balances.netByUser[uid] ?? 0;
        if (net >= -0.5) continue; // only nudge people who actually owe
        const r = recipient(uid, "notify_email_nudges");
        if (!r) continue;
        const owe = Math.round(-net * 100) / 100;
        const cap = Math.min(SEND_TIMEOUT_MS, hardLeft());
        if (timeLeft() <= 0 || cap < 1_000) {
          deferredDigestEmails++;
          continue;
        }
        try {
          await withTimeout(
            sendEmail({
              to: r.email,
              toName: r.name,
              subject: `You owe ${formatMoney(owe, house.currency)} in ${house.name}`,
              html: emailLayout(
                `<p>Hi ${escapeHtml(r.name)},</p>
                 <p>A gentle weekly nudge: you currently owe <strong>${formatMoney(owe, house.currency)}</strong>
                 across <strong>${escapeHtml(house.name)}</strong>.</p>
                 <p><a href="${siteUrl}/housemates" style="color:#5f3fe0;font-weight:bold">Settle up on HouseSync &rarr;</a></p>`,
              ),
            }),
            cap,
            "digest email",
          );
          sent++;
        } catch (e) {
          errors.push(`digest ${houseId} -> ${r.email}: ${e instanceof Error ? e.message : "error"}`);
        }
      }
    } catch (e) {
      errors.push(`digest ${houseId}: ${e instanceof Error ? e.message : "failed"}`);
    }
  }

  if (deferredHouses > 0) errors.push(`time budget reached: ${deferredHouses} house(s) not processed today`);
  if (deferredSends > 0) errors.push(`time budget reached: ${deferredSends} notification(s) not sent today`);
  if (deferredDigestEmails > 0) errors.push(`time budget reached: ${deferredDigestEmails} weekly email(s) not sent`);
  if (!isEmailConfigured) errors.push("emails skipped: no email provider configured");

  const allErrors = [...errors, ...nudges.errors];
  // Anything that means money or reminders didn't happen goes to the admin
  // error log (and its alert email), and the run reports failure to Vercel.
  const engineDown = engineFailures > 0 || deferredHouses > 0 || deferredSends > 0;
  if (allErrors.length > 0) {
    try {
      await withTimeout(
        logError({
          source: "server",
          url: "/api/cron/reminders",
          message: `Daily reminders: ${allErrors.slice(0, 12).join(" | ")}`,
          digest: engineDown ? "cron-reminders-engine" : "cron-reminders",
        }),
        6_000,
        "error log",
      );
    } catch {
      /* the JSON reply below still carries the errors */
    }
  }

  return NextResponse.json(
    {
      ok: !engineDown,
      sent,
      pushed,
      cyclesCreated,
      nudged: nudges.nudged,
      billsConsidered: engineBills.length,
      billsActionable: actionable.length,
      errors: allErrors,
    },
    { status: engineDown ? 500 : 200 },
  );
}
