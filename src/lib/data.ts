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
  PaymentDetails,
  Profile,
  RecurringBill,
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
 * Whether the active house chat has messages the user hasn't seen yet (from
 * someone else, after their last read). Drives the red dot on the Chat tab.
 * Read state lives in the DB, so it's consistent across web + native.
 */
export const getChatUnread = cache(async (houseId: string, userId: string): Promise<boolean> => {
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
  return (count ?? 0) > 0;
});

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

/** Recent house chat messages, oldest first (capped at `limit`). */
export async function getMessages(houseId: string, limit = 100): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("house_id", houseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Message[]).reverse();
}
