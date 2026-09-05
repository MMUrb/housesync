import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getActiveHouse, getHouseMembers } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { Expense, Message, Notice, RecurringBill, ShoppingItem } from "@/lib/types";

// One search across the active house: expenses and bills (Money), chat,
// the noticeboard and the shopping list. Runs with the caller's session, so
// row-level security scopes every query to houses they belong to; the house
// itself comes from the active-house cookie, never from the request.

export type SearchHit = {
  id: string;
  kind: "expense" | "bill" | "message" | "notice" | "shopping";
  title: string;
  subtitle: string;
  /** Message body or notice text, shown as a quote with the match highlighted. */
  snippet?: string;
  amount?: number;
  href: string;
  /** ISO timestamp used to order within a group (newest first). */
  at: string;
};

export type SearchGroup = "money" | "chat" | "notices" | "shopping";

export type SearchResponse = {
  q: string;
  money: SearchHit[];
  chat: SearchHit[];
  notices: SearchHit[];
  shopping: SearchHit[];
  /**
   * Groups whose query failed. Without this a broken query is indistinguishable
   * from an empty one, and the screen would report "nothing found" as fact.
   */
  failed: SearchGroup[];
};

const PER_GROUP = 12;

/**
 * ilike pattern with the user's wildcards neutralised. PostgREST also treats
 * * as an alias of % with no way to escape it, so asterisks are dropped.
 */
function cleanQuery(q: string): string {
  return q.replace(/\*/g, " ").replace(/\s+/g, " ").trim();
}
/** The tail half of a surrogate pair: half an emoji, and a stray glyph on screen. */
function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
/** slice() that will not leave half a pair behind at the cut. */
function cut(s: string, n: number): string {
  if (s.length <= n) return s;
  const last = s.charCodeAt(n - 1);
  return s.slice(0, last >= 0xd800 && last <= 0xdbff ? n - 1 : n);
}
function pattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * A short window of `text` around the first match of `q`, so the highlighted
 * term is actually in the snippet rather than 500 characters below it.
 */
function excerpt(text: string, q: string, n = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  const idx = t.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return `${t.slice(0, n - 1)}…`;
  let start = Math.max(0, Math.min(idx - Math.floor(n / 3), t.length - n));
  let end = Math.min(t.length, start + n);
  // Both edges are plain UTF-16 offsets, so either can land inside an emoji.
  if (isLowSurrogate(t.charCodeAt(start))) start += 1;
  if (end < t.length && isLowSurrogate(t.charCodeAt(end))) end += 1;
  return `${start > 0 ? "…" : ""}${t.slice(start, end)}${end < t.length ? "…" : ""}`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const house = await getActiveHouse();
  if (!house) return NextResponse.json({ error: "No house." }, { status: 404 });

  const q = cut(cleanQuery(new URL(request.url).searchParams.get("q") ?? ""), 80);
  const empty: SearchResponse = { q, money: [], chat: [], notices: [], shopping: [], failed: [] };
  if (q.length < 2) return NextResponse.json(empty);

  const pat = pattern(q);
  const amount = /^\d+(?:[.,]\d{1,2})?$/.test(q) ? Number(q.replace(",", ".")) : null;

  const [members, expByTitle, expByAmount, bills, messages, noticesByTitle, noticesByBody, shopping] =
    await Promise.all([
      getHouseMembers(house.id),
      supabase
        .from("expenses")
        .select("*")
        .eq("house_id", house.id)
        .ilike("title", pat)
        .order("date", { ascending: false })
        .limit(PER_GROUP),
      amount !== null
        ? supabase
            .from("expenses")
            .select("*")
            .eq("house_id", house.id)
            .eq("amount", amount)
            .order("date", { ascending: false })
            .limit(PER_GROUP)
        : Promise.resolve({ data: [] as Expense[], error: null }),
      supabase
        .from("recurring_bills")
        .select("*")
        .eq("house_id", house.id)
        .ilike("title", pat)
        .order("next_due_date", { ascending: true, nullsFirst: false })
        .limit(PER_GROUP),
      supabase
        .from("messages")
        .select("*")
        .eq("house_id", house.id)
        .eq("kind", "user")
        .ilike("body", pat)
        .order("created_at", { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from("notices")
        .select("*")
        .eq("house_id", house.id)
        .ilike("title", pat)
        .order("created_at", { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from("notices")
        .select("*")
        .eq("house_id", house.id)
        .ilike("message", pat)
        .order("created_at", { ascending: false })
        .limit(PER_GROUP),
      supabase
        .from("shopping_items")
        .select("*")
        .eq("house_id", house.id)
        .ilike("name", pat)
        .order("created_at", { ascending: false })
        .limit(PER_GROUP),
    ]);

  // A failed query must never render as "nothing found". Note which groups
  // broke, keep serving the ones that worked, and give up entirely only when
  // there is nothing trustworthy left to show.
  const failed: SearchGroup[] = [];
  const check = (group: SearchGroup, ...errs: ({ message: string } | null)[]) => {
    const broken = errs.filter((e): e is { message: string } => Boolean(e));
    if (broken.length === 0) return;
    console.error(`search ${group} failed:`, broken.map((e) => e.message).join("; "));
    failed.push(group);
  };
  check("money", expByTitle.error, expByAmount.error, bills.error);
  check("chat", messages.error);
  check("notices", noticesByTitle.error, noticesByBody.error);
  check("shopping", shopping.error);
  if (failed.length === 4) {
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  const nameOf = (id: string | null) =>
    id === user.id ? "You" : members.find((m) => m.user_id === id)?.profile?.name ?? "Housemate";
  const dedupe = <T extends { id: string }>(rows: T[]): T[] => {
    const seen = new Set<string>();
    return rows.filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)));
  };

  const expenses = dedupe([
    ...((expByTitle.data ?? []) as Expense[]),
    ...((expByAmount.data ?? []) as Expense[]),
  ]);

  const expenseHits: SearchHit[] = expenses
    .map<SearchHit>((e) => ({
      id: e.id,
      kind: "expense",
      title: e.title,
      subtitle: `${nameOf(e.paid_by)} paid · ${formatDate(e.date, { day: "2-digit", month: "2-digit", year: "numeric" })}`,
      amount: Number(e.amount),
      href: `/expenses#expense-${e.id}`,
      at: e.date,
    }))
    // Title matches and amount matches arrive as two lists, so date order
    // has to be restored across the join.
    .sort((a, b) => (a.at < b.at ? 1 : -1));

  // Left in the query's own order: soonest due first.
  const billHits: SearchHit[] = ((bills.data ?? []) as RecurringBill[]).map<SearchHit>((b) => ({
      id: b.id,
      kind: "bill",
      title: b.title,
      subtitle: [
        "Recurring bill",
        b.frequency,
        b.next_due_date
          ? `next ${formatDate(b.next_due_date, { day: "2-digit", month: "2-digit", year: "numeric" })}`
          : null,
        b.active ? null : "paused",
      ]
        .filter(Boolean)
        .join(" · "),
      amount: Number(b.amount),
      href: `/bills#bill-${b.id}`,
      at: b.next_due_date ?? b.created_at,
    }));

  // A bill's due date and an expense's date are different axes, so the two
  // are not sorted together. Bills lead, because a payment still to come is
  // the more actionable of the two, but they are held to half the group
  // whenever expenses also matched so neither kind can crowd out the other.
  const billRoom = Math.min(
    billHits.length,
    expenseHits.length === 0
      ? PER_GROUP
      : Math.max(PER_GROUP - expenseHits.length, Math.floor(PER_GROUP / 2)),
  );
  const money: SearchHit[] = [...billHits.slice(0, billRoom), ...expenseHits].slice(0, PER_GROUP);

  const chat: SearchHit[] = ((messages.data ?? []) as Message[]).map((m) => ({
    id: m.id,
    kind: "message",
    title: nameOf(m.user_id),
    subtitle: formatDate(m.created_at, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/London" }),
    snippet: excerpt(m.body, q),
    href: `/chat?m=${m.id}`,
    at: m.created_at,
  }));

  const notices: SearchHit[] = dedupe([
    ...((noticesByTitle.data ?? []) as Notice[]),
    ...((noticesByBody.data ?? []) as Notice[]),
  ])
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, PER_GROUP)
    .map((n) => ({
      id: n.id,
      kind: "notice",
      title: n.title,
      subtitle: `${n.pinned ? "Pinned" : "Posted"} by ${nameOf(n.posted_by)} · ${formatDate(n.created_at, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/London" })}`,
      snippet: n.message ? excerpt(n.message, q) : undefined,
      href: `/dashboard#notice-${n.id}`,
      at: n.created_at,
    }));

  const shoppingHits: SearchHit[] = ((shopping.data ?? []) as ShoppingItem[]).map((i) => ({
    id: i.id,
    kind: "shopping",
    title: i.quantity ? `${i.name} · ${i.quantity}` : i.name,
    subtitle: i.checked ? `Bought${i.checked_by ? ` by ${nameOf(i.checked_by)}` : ""}` : `Still to buy · added by ${nameOf(i.added_by)}`,
    href: "/shopping",
    at: i.created_at,
  }));

  return NextResponse.json({ q, money, chat, notices, shopping: shoppingHits, failed } satisfies SearchResponse, {
    headers: { "Cache-Control": "no-store" },
  });
}
