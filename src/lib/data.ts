import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ACTIVE_HOUSE_COOKIE } from "@/lib/constants";
import type {
  AccountSettings,
  Activity,
  Chore,
  Expense,
  ExpenseSplit,
  House,
  HouseCategory,
  MemberWithProfile,
  Message,
  Notice,
  PaymentDetails,
  Profile,
  RecurringBill,
  Settlement,
  ShoppingItem,
} from "@/lib/types";

/** The currently signed-in auth user (deduped per request). */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  return (data as Profile | null) ?? null;
});

/** Private account settings (phone + reminder opt-ins) for the current user. */
export const getAccountSettings = cache(async (): Promise<AccountSettings | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("account_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as AccountSettings | null) ?? null;
});

/** Whether push reaches the current user on any device (an app install or a browser). */
export async function hasPushSubscription(): Promise<boolean> {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { count } = await supabase
    .from("push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  return (count ?? 0) > 0;
}

/** All houses the current user is a member of, oldest first. */
export const getMyHouses = cache(async (): Promise<House[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("house_members")
    .select("house:houses(*)")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: true });
  const rows = (data ?? []) as Array<{ house: House | House[] | null }>;
  return rows
    .map((row) => (Array.isArray(row.house) ? row.house[0] : row.house))
    .filter((h): h is House => Boolean(h));
});

/** The user's active house (from cookie, else their first house). */
export async function getActiveHouse(): Promise<House | null> {
  const houses = await getMyHouses();
  if (houses.length === 0) return null;
  const cookieStore = await cookies();
  const wanted = cookieStore.get(ACTIVE_HOUSE_COOKIE)?.value;
  return houses.find((h) => h.id === wanted) ?? houses[0];
}

/**
 * Payment handles the current user is allowed to see, keyed by user id.
 * RLS does the gating — your own row always comes back; housemates' rows only
 * while they've left "share with house" on. Missing user = nothing shared.
 */
export const getVisiblePaymentDetails = cache(async (): Promise<Map<string, PaymentDetails>> => {
  const supabase = await createClient();
  const { data } = await supabase.from("payment_details").select("*");
  return new Map(((data ?? []) as PaymentDetails[]).map((p) => [p.user_id, p]));
});

/**
 * How many chat messages the user hasn't seen yet (from someone else, after
 * their last read). Drives the count badge on the Chat tab. Read state lives in
 * the DB, so it's consistent across web + native.
 */
export const getChatUnreadCount = cache(
  async (houseId: string, userId: string): Promise<number> => {
    const supabase = await createClient();
    const { data: read } = await supabase
      .from("message_reads")
      .select("last_read_at")
      .eq("user_id", userId)
      .eq("house_id", houseId)
      .maybeSingle();
    const since = read?.last_read_at ?? "1970-01-01T00:00:00Z";
    const { count } = await supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("house_id", houseId)
      .neq("user_id", userId)
      .gt("created_at", since);
    return count ?? 0;
  },
);

/**
 * Unread chat counts for several houses at once, keyed by house id. Powers the
 * per-house badges in the house switcher. Each house's read threshold differs,
 * so we read all of the user's thresholds in one query, then count per house
 * (houses per user are few, so a handful of count queries is fine).
 */
export const getChatUnreadCounts = cache(
  async (houseIds: string[], userId: string): Promise<Record<string, number>> => {
    if (houseIds.length === 0) return {};
    const supabase = await createClient();
    const { data: reads } = await supabase
      .from("message_reads")
      .select("house_id, last_read_at")
      .eq("user_id", userId)
      .in("house_id", houseIds);
    const readBy = new Map((reads ?? []).map((r) => [r.house_id, r.last_read_at]));

    const entries = await Promise.all(
      houseIds.map(async (houseId) => {
        const since = readBy.get(houseId) ?? "1970-01-01T00:00:00Z";
        const { count } = await supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("house_id", houseId)
          .neq("user_id", userId)
          .gt("created_at", since);
        return [houseId, count ?? 0] as const;
      }),
    );
    return Object.fromEntries(entries);
  },
);

/** The house's editable expense categories (active only), in display order. */
export const getHouseCategories = cache(async (houseId: string): Promise<HouseCategory[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("house_categories")
    .select("*")
    .eq("house_id", houseId)
    .eq("archived", false)
    .order("sort", { ascending: true });
  return (data ?? []) as HouseCategory[];
});

/** Members of a house, each with their profile, oldest first. */
export const getHouseMembers = cache(async (houseId: string): Promise<MemberWithProfile[]> => {
  const supabase = await createClient();
  const { data: members } = await supabase
    .from("house_members")
    .select("*")
    .eq("house_id", houseId)
    .order("joined_at", { ascending: true });

  if (!members || members.length === 0) return [];

  const ids = members.map((m) => m.user_id);
  const { data: profiles } = await supabase.from("profiles").select("*").in("id", ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p as Profile]));

  return members.map((m) => ({ ...m, profile: byId.get(m.user_id) ?? null })) as MemberWithProfile[];
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Guard for app screens: ensures the user is signed in AND has a house.
 * Redirects to onboarding if they have no house yet.
 */
export async function requireHouse() {
  const user = await requireUser();
  const house = await getActiveHouse();
  if (!house) redirect("/house/create");
  const [profile, members] = await Promise.all([getProfile(), getHouseMembers(house.id)]);
  return { user, profile, house, members };
}

/** Look up a profile within a member list (helper for rendering). */
export function memberName(members: MemberWithProfile[], userId: string | null): string {
  if (!userId) return "Someone";
  const m = members.find((x) => x.user_id === userId);
  return m?.profile?.name ?? "Someone";
}

// ---------------------------------------------------------------------------
// House-scoped queries
// ---------------------------------------------------------------------------

export async function getExpenses(houseId: string): Promise<Expense[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .eq("house_id", houseId)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  return (data ?? []) as Expense[];
}

export async function getSplitsForExpenses(expenseIds: string[]): Promise<ExpenseSplit[]> {
  if (expenseIds.length === 0) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("expense_splits").select("*").in("expense_id", expenseIds);
  return (data ?? []) as ExpenseSplit[];
}

/** All splits for a house in a single query (joins through expenses). */
export async function getSplitsForHouse(houseId: string): Promise<ExpenseSplit[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("expense_splits")
    .select("*, expenses!inner(house_id)")
    .eq("expenses.house_id", houseId);
  const rows = (data ?? []) as Array<ExpenseSplit & { expenses?: unknown }>;
  // Strip the nested join object so callers get clean ExpenseSplit rows.
  return rows.map(({ expenses, ...rest }) => rest as ExpenseSplit);
}

/**
 * Expenses for a house plus all of their splits — fetched IN PARALLEL
 * (two round-trips at once instead of one-after-the-other).
 */
export async function getExpensesAndSplits(
  houseId: string,
): Promise<{ expenses: Expense[]; splits: ExpenseSplit[] }> {
  const [expenses, splits] = await Promise.all([
    getExpenses(houseId),
    getSplitsForHouse(houseId),
  ]);
  return { expenses, splits };
}

export async function getBills(houseId: string): Promise<RecurringBill[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("recurring_bills")
    .select("*")
    .eq("house_id", houseId)
    .order("next_due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as RecurringBill[];
}

export async function getChores(houseId: string): Promise<Chore[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chores")
    .select("*")
    .eq("house_id", houseId)
    .order("due_date", { ascending: true, nullsFirst: false });
  return (data ?? []) as Chore[];
}

export async function getActivity(houseId: string, limit = 20): Promise<Activity[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity")
    .select("*")
    .eq("house_id", houseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Activity[];
}

/** House noticeboard entries, pinned first then newest first. */
export async function getNotices(houseId: string, limit = 50): Promise<Notice[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notices")
    .select("*")
    .eq("house_id", houseId)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as Notice[];
}

/** Shared shopping list for a house, oldest first (stable as items are added). */
export async function getShoppingItems(houseId: string): Promise<ShoppingItem[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("shopping_items")
    .select("*")
    .eq("house_id", houseId)
    .order("created_at", { ascending: true });
  return (data ?? []) as ShoppingItem[];
}

/** All settlement rows for a house (simplified settle mode), oldest first. */
export async function getSettlements(houseId: string): Promise<Settlement[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("settlements")
    .select("*")
    .eq("house_id", houseId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Settlement[];
}

/** Someone the house admin removed (migration 0046). name/avatar are a
 *  snapshot from the moment of removal: their profile stops being readable. */
export type RemovedHousemate = {
  userId: string;
  /** Null when they had no name set. */
  name: string | null;
  color: string | null;
  avatarUrl: string | null;
  removedAt: string;
  /** Set once the admin invites them back; cleared again when they rejoin. */
  reinvitedAt: string | null;
};

/** Newest removal first. RLS shows departures only to the house admin, so
 *  everyone else gets an empty list (as does a database without 0046). */
export async function getRemovedHousemates(houseId: string): Promise<RemovedHousemate[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("house_departures")
    .select("user_id, name, avatar_color, avatar_url, departed_at, reinvited_at")
    .eq("house_id", houseId)
    .eq("kind", "removed")
    .order("departed_at", { ascending: false });
  return (data ?? []).map((r) => ({
    userId: r.user_id as string,
    name: r.name as string | null,
    color: r.avatar_color as string | null,
    avatarUrl: r.avatar_url as string | null,
    removedAt: r.departed_at as string,
    reinvitedAt: r.reinvited_at as string | null,
  }));
}

/** Someone who left or was removed while the house still counts them in. */
export type DepartureReminder = {
  userId: string;
  /** Snapshot from when they went; null when they had no name set. */
  name: string | null;
  kind: "left" | "removed";
  departedAt: string;
  /** Active bills whose saved split still gives them a share, and who pays each. */
  splitBills: { id: string; title: string; payerId: string | null }[];
  /** Active bills they were the payer of. */
  paidBills: { id: string; title: string }[];
  /** Money still open between them and the house, in either direction. */
  unsettled: number;
};

/**
 * For the admin's "adjust their share" reminder: everyone who has left or been
 * removed and is still in a bill's split, still paying a bill, or still has
 * money open with the house. Costs one query when nobody has gone.
 */
export async function getDepartureReminders(
  houseId: string,
  memberIds: string[],
): Promise<DepartureReminder[]> {
  const supabase = await createClient();
  const { data: deps } = await supabase
    .from("house_departures")
    .select("user_id, name, kind, departed_at")
    .eq("house_id", houseId)
    .order("departed_at", { ascending: false });
  const gone = (deps ?? []).filter((d) => !memberIds.includes(d.user_id as string));
  if (gone.length === 0) return [];
  const goneIds = gone.map((d) => d.user_id as string);

  const [{ data: bills }, { data: owes }, { data: owed }] = await Promise.all([
    supabase
      .from("recurring_bills")
      .select("id, title, paid_by, bill_splits(user_id)")
      .eq("house_id", houseId)
      .eq("active", true),
    // What they still owe others (not their own share of their own expense).
    supabase
      .from("expense_splits")
      .select("user_id, amount_owed, expenses!inner(house_id, paid_by)")
      .eq("expenses.house_id", houseId)
      .in("user_id", goneIds)
      .neq("status", "confirmed"),
    // What others still owe them.
    supabase
      .from("expense_splits")
      .select("user_id, amount_owed, expenses!inner(house_id, paid_by)")
      .eq("expenses.house_id", houseId)
      .in("expenses.paid_by", goneIds)
      .neq("status", "confirmed"),
  ]);

  type BillRow = { id: string; title: string; paid_by: string | null; bill_splits: { user_id: string }[] | null };
  type SplitRow = { user_id: string; amount_owed: number | string; expenses: { paid_by: string | null } };
  const open = new Map<string, number>();
  for (const s of (owes ?? []) as unknown as SplitRow[]) {
    if (s.expenses.paid_by === s.user_id) continue;
    open.set(s.user_id, (open.get(s.user_id) ?? 0) + Number(s.amount_owed));
  }
  for (const s of (owed ?? []) as unknown as SplitRow[]) {
    const payer = s.expenses.paid_by;
    if (!payer || s.user_id === payer) continue;
    open.set(payer, (open.get(payer) ?? 0) + Number(s.amount_owed));
  }

  const billRows = (bills ?? []) as unknown as BillRow[];
  return gone
    .map((d) => {
      const uid = d.user_id as string;
      return {
        userId: uid,
        name: d.name as string | null,
        kind: d.kind as "left" | "removed",
        departedAt: d.departed_at as string,
        splitBills: billRows
          .filter((b) => (b.bill_splits ?? []).some((p) => p.user_id === uid))
          .map((b) => ({ id: b.id, title: b.title, payerId: b.paid_by })),
        paidBills: billRows
          .filter((b) => b.paid_by === uid)
          .map((b) => ({ id: b.id, title: b.title })),
        unsettled: Math.round((open.get(uid) ?? 0) * 100) / 100,
      };
    })
    .filter((r) => r.splitBills.length > 0 || r.paidBills.length > 0 || r.unsettled >= 0.01);
}

/**
 * A window of chat around one message (for "open at this message" from
 * search): up to 50 older, the message itself, up to 50 newer, oldest first.
 * Null when the message is not in this house. The two flags say whether
 * there is more history beyond each edge of the window.
 */
export async function getMessageWindow(
  houseId: string,
  messageId: string,
): Promise<{ messages: Message[]; hasMoreOlder: boolean; hasMoreNewer: boolean } | null> {
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("messages")
    .select("*")
    .eq("house_id", houseId)
    .eq("id", messageId)
    .maybeSingle();
  if (!target) return null;
  const t = target as Message;
  const [b, a] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("house_id", houseId)
      .lt("created_at", t.created_at)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("messages")
      .select("*")
      .eq("house_id", houseId)
      .gt("created_at", t.created_at)
      .order("created_at", { ascending: true })
      .limit(51),
  ]);
  // A failed side query must not be read as "nothing beyond this edge": the
  // client would treat the window as the live end and stitch a hole. Fall
  // through to the normal thread instead.
  if (b.error || a.error) return null;
  const before = b.data;
  const after = a.data;
  const older = ((before ?? []) as Message[]).reverse();
  const newerAll = (after ?? []) as Message[];
  const newer = newerAll.slice(0, 50);
  return {
    messages: [...older, t, ...newer],
    hasMoreOlder: older.length === 50,
    hasMoreNewer: newerAll.length > 50,
  };
}

/** Recent house chat messages, oldest first (capped at `limit`). */
export async function getMessages(houseId: string, limit = 100): Promise<Message[]> {
  return (await loadMessages(houseId, limit)).messages;
}

/**
 * Newest messages, and whether the read actually succeeded.
 *
 * The distinction matters only to the chat screen: an empty list from a
 * failed query is indistinguishable from a house that has never said
 * anything, and rendering "No messages yet" over a broken read is a lie the
 * reader acts on. Throwing instead is worse: the page is force-dynamic, so
 * every router.refresh() re-runs it, and the only boundary above it
 * replaces the whole app shell and unmounts a working thread.
 */
export async function loadMessages(
  houseId: string,
  limit = 100,
): Promise<{ messages: Message[]; failed: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("house_id", houseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { messages: ((data ?? []) as Message[]).reverse(), failed: Boolean(error) };
}
